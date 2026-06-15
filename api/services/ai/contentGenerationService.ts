import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import type { Keyword } from "@shared/types/graph";
import {
  isEnglishLanguage,
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import { parseAIResponse, withAIPerformanceTracking } from "./utils";
import { withTimeoutAndRetry, TimeoutError, RetryError, DEFAULT_TIMEOUT, LONG_TIMEOUT } from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { performanceMonitor } from "./performanceMonitor";
import { pricingService } from "./pricingService";
import { getMockResponse } from "./mock";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";

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

        return withAIPerformanceTracking(
          {
            operation: "generateLearningMaterial",
            provider: provider.providerType,
            model,
            metadata: {
              topic: topic,
              userId: options.userId,
            },
          },
          async () => {
            const templateContext = {
              topic,
              context: context || "General knowledge",
              level: options.level,
            };

            const systemPrompt = await promptService.getRenderedPrompt(
              getSupabaseAdmin(),
              "learning_material",
              templateContext,
              options.userId,
              options.graphId,
              options.language,
            );

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

        return withAIPerformanceTracking(
          {
            operation: "generateTaskDetails",
            provider: provider.providerType,
            model,
            metadata: {
              title: title,
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
}

export const contentGenerationService = new ContentGenerationService();
