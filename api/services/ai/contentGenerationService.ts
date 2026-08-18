import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import type { Keyword } from "@shared/types/graph";
import {
  isEnglishLanguage,
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import { withTimeoutAndRetry, TimeoutError, RetryError, DEFAULT_TIMEOUT, LONG_TIMEOUT } from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { performanceMonitor } from "./performanceMonitor";
import { pricingService } from "./pricingService";
import { getMockResponse } from "./mock";
import { promptService, getLanguageInstruction } from "./promptService";
import { learningMaterialSchemaService } from "./learningMaterialSchemaService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { TemplateEngine } from "../../utils/templateEngine";

export interface GenerateLearningMaterialResult {
  content: string;
  keywords: Keyword[];
}

export class ContentGenerationService {
  async generatePodcastScript(
    context: string,
    language: string = "zh-CN",
  ): Promise<string> {
    const provider = await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return `**主持人**: 大家好，欢迎来到今天的知识播客！今天我们要聊的主题非常有意思。

**主持人**: 不过，很遗憾，由于我还没有连接到 AI 大脑（API Key 未配置），我只能简单和你打个招呼。

**主持人**: 请配置好 API Key 后，我将为你带来精彩的深度解读！`;
    }

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "podcast_system",
      {},
      undefined,
      undefined,
      language,
    );
    const userPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "podcast_script",
      {
        context,
        language:
          language === "zh-CN" || language === "zh" ? "Chinese" : "English",
      },
      undefined,
      undefined,
      language,
    );

    const requestKey = generateRequestKey("generatePodcastScript", {
      context: context.slice(0, 200),
      language,
      model: provider.model,
    });

    const startTime = Date.now();
    try {
      return await dedupedRequest(requestKey, async () => {
        const completion = await withTimeoutAndRetry(
          () =>
            provider.client.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content: systemPrompt,
                },
                { role: "user", content: userPrompt },
              ],
              model: provider.model,
            }),
          {
            timeout: LONG_TIMEOUT,
            maxRetries: 3,
            onRetry: (attempt, error) => {
              logger.warn(
                `Generate Podcast Script retry attempt ${attempt}: ${error.message}`,
              );
            },
          },
        );

        const inputTokens = completion.usage?.prompt_tokens || 0;
        const outputTokens = completion.usage?.completion_tokens || 0;
        const totalTokens = inputTokens + outputTokens;
        const estimatedCost = pricingService.calculateCost(
          provider.providerType,
          provider.model,
          inputTokens,
          outputTokens,
        );

        await performanceMonitor.recordLog({
          operation: "generate_podcast_script",
          provider: provider.providerType,
          model: provider.model,
          inputTokens,
          outputTokens,
          totalTokens,
          estimatedCost,
          duration: Date.now() - startTime,
          success: true,
        });

        return completion.choices[0].message.content || "";
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Generate Podcast Script Error:", error);

      await performanceMonitor.recordLog({
        operation: "generate_podcast_script",
        provider: provider.providerType,
        model: provider.model,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCost: 0,
        duration: Date.now() - startTime,
        success: false,
        errorMessage: err.message,
      });

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "Failed to generate podcast script",
      });
    }
  }

  async generateLearningMaterial(
    topic: string,
    context: string,
    options: {
      provider?: AIProviderType;
      model?: string;
      level?: string;
      userId?: string;
      graphId?: string;
      language?: string;
      schema_id?: string;
    } = {},
  ): Promise<GenerateLearningMaterialResult> {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      const mockContent = getMockResponse(
        "content",
        `Learning Material for ${topic}`,
      );
      return {
        content:
          typeof mockContent === "string"
            ? mockContent
            : JSON.stringify(mockContent),
        keywords: [
          {
            term: topic,
            importance: 5,
            category: isEnglishLanguage(options.language) ? "Concept" : "概念",
            explanation: isEnglishLanguage(options.language)
              ? `Core concept of ${topic}`
              : `关于${topic}的核心概念`,
          },
        ],
      };
    }

    const requestKey = generateRequestKey("generateLearningMaterial", {
      topic: topic.slice(0, 100),
      level: options.level || "normal",
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "generateLearningMaterial",
            provider: provider.providerType,
            model,
            metadata: {
              topic,
              userId: options.userId,
            },
          },
          async () => {
            const templateContext = {
              topic,
              context: context || "General knowledge",
              level: options.level,
            };

            // ============================================================
            // 分支1：有 schema_id 或 通过优先级能解析到 schema → 动态拼装 prompt
            //        这样用户可以通过可视化章节编辑器自由组合章节
            // 分支2：未使用 schema → 走原有 prompt_templates 流程
            // ============================================================
            let systemPrompt = "";
            const supabaseAdmin = getSupabaseAdmin();
            const schemaId = options.schema_id?.trim();
            let resolvedSchema = schemaId
              ? await learningMaterialSchemaService.get(supabaseAdmin, schemaId)
              : null;

            // 如果用户没传 schema_id，但 userId 存在 → 尝试按优先级解析默认 schema
            if (!resolvedSchema && options.userId) {
              resolvedSchema = await learningMaterialSchemaService
                .resolveEffectiveSchema(
                  supabaseAdmin,
                  options.userId,
                  options.graphId,
                )
                .catch(() => null);
            }

            if (resolvedSchema && resolvedSchema.sections.length > 0) {
              logger.info(
                `[learning_material] using schema=${resolvedSchema.id} name=${resolvedSchema.name} scope=${resolvedSchema.scope}`,
              );
              const promptBase = promptService.buildPromptFromSchema(resolvedSchema);
              try {
                systemPrompt = TemplateEngine.render(promptBase, templateContext);
              } catch (e) {
                logger.error("Failed to render schema-based prompt", e);
                systemPrompt = promptBase;
              }
              // 追加 output schema / language 指令（与 getRenderedPrompt 保持一致）
              const outputLanguage = isEnglishLanguage(options.language)
                ? "English"
                : "Chinese";
              systemPrompt = systemPrompt.replace(
                /\{\{outputLanguage\}\}/g,
                outputLanguage,
              );
              const categoryOptions = isEnglishLanguage(options.language)
                ? "'Definition', 'Concept', 'Method', 'Conclusion', 'Principle', 'Application', 'Terminology'"
                : "'定义', '概念', '方法', '结论', '原理', '应用', '术语'";
              systemPrompt = systemPrompt.replace(
                /\{\{categoryOptions\}\}/g,
                categoryOptions,
              );
              const { OUTPUT_SCHEMAS } = await import("./promptConstants");
              if (OUTPUT_SCHEMAS.learning_material) {
                systemPrompt += `\n\n${OUTPUT_SCHEMAS.learning_material}`.replace(
                  /\{\{outputLanguage\}\}/g,
                  outputLanguage,
                );
              }
              const langInstr = getLanguageInstruction(options.language);
              systemPrompt += `\n\n${langInstr}`;
            } else {
              // 分支2：走原有 prompt_templates 优先级链路
              systemPrompt = await promptService.getRenderedPrompt(
                supabaseAdmin,
                "learning_material",
                templateContext,
                options.userId,
                options.graphId,
                options.language,
              );
            }

            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    {
                      role: "system",
                      content: systemPrompt,
                    },
                    {
                      role: "user",
                      content: `Please generate the learning material based on the instructions above.`,
                    },
                  ],
                  model,
                  response_format: { type: "json_object" },
                }),
              {
                timeout: LONG_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
                  logger.warn(
                    `Generate Learning Material retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const rawContent = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{
              content: string;
              keywords: Keyword[];
            }>(rawContent, "Generate Learning Material");

            return {
              result: {
                content: parsed.content || "",
                keywords: Array.isArray(parsed.keywords)
                  ? parsed.keywords.map((k) => ({
                      term: k.term || "",
                      importance: Math.min(5, Math.max(1, k.importance || 3)),
                      category:
                        k.category ||
                        (isEnglishLanguage(options.language)
                          ? "Concept"
                          : "概念"),
                      explanation: k.explanation || "",
                    }))
                  : [],
              },
              usage: completion.usage,
            };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Learning Material Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI generation failed",
      });
    }
  }

  async generateTaskDetails(
    title: string,
    options: {
      provider?: AIProviderType;
      model?: string;
      context?: string;
      userId?: string;
      language?: string;
    } = {},
  ): Promise<{
    description: string;
    tags: string[];
    estimated_duration: number;
    priority: number;
    suggested_queue: number;
  }> {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return {
        description: `这是一个关于"${title}"的任务。请根据任务标题合理安排时间完成。`,
        tags: ["待分类"],
        estimated_duration: 25,
        priority: 2,
        suggested_queue: 2,
      };
    }

    const requestKey = generateRequestKey("generateTaskDetails", {
      title: title.slice(0, 100),
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "generateTaskDetails",
            provider: provider.providerType,
            model,
            metadata: {
              title,
              userId: options.userId,
            },
          },
          async () => {
            const systemPrompt = await promptService.getRenderedPrompt(
              getSupabaseAdmin(),
              "generate_task_details",
              {
                title,
                context: options.context || "",
              },
              options.userId,
              undefined,
              options.language,
            );

            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: `任务标题：${title}${
                        options.context
                          ? `\n\n补充信息：${options.context}`
                          : ""
                      }`,
                    },
                  ],
                  model,
                  response_format: { type: "json_object" },
                }),
              {
                timeout: DEFAULT_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
                  logger.warn(
                    `Generate Task Details retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const content = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{
              description: string;
              tags: string[];
              estimated_duration: number;
              priority: number;
              suggested_queue: number;
            }>(content, "Generate Task Details");

            const result = {
              description: parsed.description || "",
              tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
              estimated_duration: Math.min(
                180,
                Math.max(15, parsed.estimated_duration || 25),
              ),
              priority: Math.min(4, Math.max(1, parsed.priority || 2)),
              suggested_queue: Math.min(
                2,
                Math.max(0, parsed.suggested_queue || 2),
              ),
            };

            return {
              result,
              usage: completion.usage,
            };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Generate Task Details Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI 任务详情生成失败",
      });
    }
  }

  /**
   * AI 辅助设计学习材料章节结构
   * - mode="generate": 根据主题 + 学习目标从零生成整套章节
   * - mode="optimize": 优化现有章节（更具体的指令、调整字数、增删章节）
   */
  async assistLearningSchema(
    mode: "generate" | "optimize",
    topic: string,
    options: {
      goal?: string;
      existingSections?: { title: string; instruction: string; min_words?: number; max_words?: number }[];
      language?: string;
      userId?: string;
      graphId?: string;
      provider?: AIProviderType;
      model?: string;
    } = {},
  ): Promise<{ sections: { title: string; instruction: string; min_words?: number; max_words?: number }[] }> {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    const language = options.language || "zh-CN";
    const isEnglish = isEnglishLanguage(language);

    // 无 Key 时返回一份可用的演示结构（保证 UI 可体验）
    if (!provider.hasKey) {
      return {
        sections: [
          {
            title: isEnglish ? "Introduction" : "引言",
            instruction: isEnglish
              ? "Explain what this topic is and why it matters, with a hook."
              : "说明该主题是什么、为什么重要，用一个引人入胜的开头。",
            min_words: 100,
            max_words: 250,
          },
          {
            title: isEnglish ? "Core Concepts" : "核心概念",
            instruction: isEnglish
              ? "Explain the theoretical foundations with analogies."
              : "讲解理论基础，善用类比。",
            min_words: 200,
            max_words: 500,
          },
          {
            title: isEnglish ? "Summary" : "总结",
            instruction: isEnglish
              ? "Summarize the key takeaways."
              : "总结本章要点。",
            min_words: 80,
            max_words: 200,
          },
        ],
      };
    }

    const existingSectionsText = options.existingSections?.length
      ? JSON.stringify(
          options.existingSections.map((s) => ({
            title: s.title,
            instruction: s.instruction,
            min_words: s.min_words,
            max_words: s.max_words,
          })),
          null,
          2,
        )
      : "";

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "learning_schema_assist",
      {
        modeLabel:
          mode === "optimize"
            ? isEnglish
              ? "optimize the existing"
              : "优化现有"
            : isEnglish
              ? "design a new"
              : "设计一套新的",
        isOptimize: mode === "optimize",
        existingSections: existingSectionsText,
        goal: options.goal ?? "",
        topic,
        outputLanguage: isEnglish ? "English" : "Chinese",
      },
      options.userId,
      options.graphId,
      language,
    );

    const requestKey = generateRequestKey("assistLearningSchema", {
      mode,
      topic: topic.slice(0, 100),
      goal: (options.goal ?? "").slice(0, 100),
      sectionCount: options.existingSections?.length ?? 0,
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "assistLearningSchema",
            provider: provider.providerType,
            model,
            metadata: { topic, mode, userId: options.userId },
          },
          async () => {
            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: isEnglish
                        ? `Please ${mode} the chapter schema for topic: ${topic}`
                        : `请${mode === "optimize" ? "优化" : "设计"}主题「${topic}」的章节结构`,
                    },
                  ],
                  model,
                  response_format: { type: "json_object" },
                }),
              {
                timeout: DEFAULT_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
                  logger.warn(
                    `Assist Learning Schema retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const content = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{
              sections: {
                title?: string;
                instruction?: string;
                min_words?: number;
                max_words?: number;
              }[];
            }>(content, "Assist Learning Schema");

            // 清洗 + 兜底，保证返回结构可用
            const sections = (Array.isArray(parsed.sections) ? parsed.sections : [])
              .filter(
                (s): s is { title: string; instruction: string; min_words?: number; max_words?: number } =>
                  Boolean(s) &&
                  typeof s.title === "string" &&
                  s.title.trim() !== "" &&
                  typeof s.instruction === "string" &&
                  s.instruction.trim() !== "",
              )
              .slice(0, 12)
              .map((s) => ({
                title: s.title.trim().slice(0, 100),
                instruction: s.instruction.trim().slice(0, 1000),
                min_words: Number.isFinite(s.min_words)
                  ? Math.min(2000, Math.max(50, Number(s.min_words)))
                  : undefined,
                max_words: Number.isFinite(s.max_words)
                  ? Math.min(3000, Math.max(100, Number(s.max_words)))
                  : undefined,
              }));

            if (sections.length === 0) {
              throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
                message: "AI 未返回有效的章节结构，请重试或换个主题描述",
              });
            }

            return { result: { sections }, usage: completion.usage };
          },
        );
      });
    } catch (error: unknown) {
      if (error instanceof AppError) throw error;
      const err = error as Error;
      logger.error("AI Assist Learning Schema Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI 章节结构生成失败",
      });
    }
  }
}

export const contentGenerationService = new ContentGenerationService();
