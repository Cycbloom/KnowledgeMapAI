import type { AIProviderType } from "@shared/types";
import {
  BackboneModule,
  BACKBONE_MODULE_LABELS,
  type BackboneModuleCustomConfig,
} from "@shared/types/graph";
import { getAIProviderForTask, getAIProvider } from "./factory";
import { promptService } from "./promptService";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { getSupabaseAdmin } from "../../supabase";
import {
  BACKBONE_MODULE_CONFIGS,
  validateBackbone,
  validateAndCorrectBackboneNodeTitle,
  getMockBackbone,
  deduplicateBackboneNodes,
  type BackboneNode,
  type BackboneModuleConfig,
  type BackboneNetwork,
} from "./backboneNetworkShared";

// 类型 re-export：保持既有调用方从本文件导入类型
export type {
  BackboneNode,
  BackboneEdge,
  BackboneModuleConfig,
  BackboneNetwork,
} from "./backboneNetworkShared";

export interface GenerateBackboneOptions {
  topic: string;
  context?: string;
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  includeModules?: BackboneModule[];
  maxNodesPerModule?: number;
  customModules?: BackboneModuleCustomConfig[];
}

export interface GenerateBackboneResult {
  backbone: BackboneNetwork;
  metadata: {
    topic: string;
    generatedAt: string;
    provider: string;
    model: string;
  };
}

export class BackboneNetworkService {
  async generateBackbone(
    options: GenerateBackboneOptions,
  ): Promise<GenerateBackboneResult> {
    const {
      topic,
      provider: providerType,
      includeModules = [
        BackboneModule.RESEARCH_BACKGROUND,
        BackboneModule.LITERATURE_REVIEW,
        BackboneModule.RESEARCH_METHODS,
        BackboneModule.CORE_CONCEPTS,
        BackboneModule.APPLICATION_DOMAINS,
        BackboneModule.FUTURE_DIRECTIONS,
      ],
      customModules,
    } = options;

    const effectiveIncludeModules =
      customModules && customModules.length > 0
        ? (customModules.map((m) => m.module_type) as BackboneModule[])
        : includeModules;

    const provider = providerType
      ? await getAIProvider(providerType)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      logger.info(
        "[Backbone Network] No API key configured, returning mock backbone",
      );
      return getMockBackbone(topic, effectiveIncludeModules, customModules);
    }

    const metadata = {
      userId: options.userId,
      graphId: options.graphId,
      topic: options.topic,
      templateType: effectiveIncludeModules.join(","),
    };

    try {
      // withAIMonitoring 统一记录 token/成本/耗时/成功率，替代手写双 recordLog
      const result = await withAIMonitoring<GenerateBackboneResult>(
        {
          operation: "backbone_generation",
          provider: provider.providerType,
          model: options.model || provider.model,
          metadata,
        },
        () =>
          this.callAI(provider, {
            ...options,
            includeModules: effectiveIncludeModules,
            customModules,
          }),
      );

      return result;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("[Backbone Network] AI Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI backbone generation failed",
      });
    }
  }

  private async callAI(
    provider: {
      providerType: AIProviderType;
      model: string;
      hasKey: boolean;
      client: unknown;
    },
    options: GenerateBackboneOptions & {
      includeModules: BackboneModule[];
      customModules?: BackboneModuleCustomConfig[];
    },
  ): Promise<{
    result: GenerateBackboneResult;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      prompt_tokens_details?: { cached_tokens?: number; audio_tokens?: number };
      completion_tokens_details?: {
        reasoning_tokens?: number;
        audio_tokens?: number;
      };
    };
  }> {
    const {
      topic,
      context,
      includeModules,
      maxNodesPerModule = 5,
      customModules,
    } = options;
    const model = options.model || provider.model;

    const systemPrompt = await this.buildSystemPrompt(
      includeModules,
      maxNodesPerModule,
      options.userId,
      options.graphId,
      customModules,
    );

    const userPrompt = this.buildUserPrompt(
      topic,
      context,
      includeModules,
      customModules,
    );

    const client = provider.client as {
      chat: {
        completions: {
          create: (params: {
            messages: Array<{ role: string; content: string }>;
            model: string;
            response_format?: { type: string };
            max_tokens?: number;
          }) => Promise<{
            choices: Array<{ message: { content: string | null } }>;
            usage?: {
              prompt_tokens?: number;
              completion_tokens?: number;
              prompt_tokens_details?: {
                cached_tokens?: number;
                audio_tokens?: number;
              };
              completion_tokens_details?: {
                reasoning_tokens?: number;
                audio_tokens?: number;
              };
            };
          }>;
        };
      };
    };

    const completion = await withTimeoutAndRetry(
      () =>
        client.chat.completions.create({
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          model,
          response_format: { type: "json_object" },
          max_tokens: 4000,
        }),
      {
        timeout: LONG_TIMEOUT,
        maxRetries: 3,
        onRetry: (attempt, error) => {
          logger.warn(
            `[Backbone Network] Retry attempt ${attempt}: ${error.message}`,
          );
        },
      },
    );

    const content = completion.choices[0].message.content;

    if (!content) {
      logger.error("[Backbone Network] Empty response from AI");
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: "AI 返回了空响应",
      });
    }

    const parsed = parseAIResponse<{ backbone: unknown }>(
      content,
      "Backbone Generation",
    );

    const validatedBackbone = validateBackbone(
      parsed.backbone,
      topic,
      includeModules,
      customModules,
    );

    if (!validatedBackbone) {
      logger.warn("[Backbone Network] No valid backbone generated, using mock");
      return {
        result: getMockBackbone(topic, includeModules, customModules),
        usage: completion.usage,
      };
    }

    const correctedNodes: BackboneNode[] = [];
    const titleCorrections: Array<{
      nodeId: string;
      originalTitle: string;
      correctedTitle: string;
      module: string;
    }> = [];

    const customModuleTitles =
      customModules && customModules.length > 0
        ? new Map(customModules.map((cm) => [cm.module_type, cm.title]))
        : undefined;

    for (const node of validatedBackbone.nodes) {
      const { correctedNode, wasCorrected, originalTitle } =
        validateAndCorrectBackboneNodeTitle(node, customModuleTitles);

      if (wasCorrected && originalTitle) {
        titleCorrections.push({
          nodeId: node.id,
          originalTitle,
          correctedTitle: correctedNode.title,
          module: node.module,
        });
      }

      const nodeWithModule: BackboneNode = {
        ...correctedNode,
        properties: {
          ...correctedNode.properties,
          backboneModule: correctedNode.module,
        },
      };

      correctedNodes.push(nodeWithModule);
    }

    if (titleCorrections.length > 0) {
      logger.info("[Backbone Network] Title corrections applied:", {
        count: titleCorrections.length,
        corrections: titleCorrections.map(
          (c) => `"${c.originalTitle}" -> "${c.correctedTitle}" (${c.module})`,
        ),
      });
    }

    const deduplicatedNodes = deduplicateBackboneNodes(correctedNodes);

    if (deduplicatedNodes.length < correctedNodes.length) {
      logger.info("[Backbone Network] Deduplicated backbone nodes:", {
        originalCount: correctedNodes.length,
        deduplicatedCount: deduplicatedNodes.length,
        removedCount: correctedNodes.length - deduplicatedNodes.length,
      });
    }

    const finalBackbone: BackboneNetwork = {
      ...validatedBackbone,
      nodes: deduplicatedNodes,
    };

    return {
      result: {
        backbone: finalBackbone,
        metadata: {
          topic,
          generatedAt: new Date().toISOString(),
          provider: provider.providerType,
          model,
        },
      },
      usage: completion.usage,
    };
  }

  private async buildSystemPrompt(
    includeModules: BackboneModule[],
    maxNodesPerModule: number,
    userId?: string,
    graphId?: string,
    customModules?: BackboneModuleCustomConfig[],
  ): Promise<string> {
    const useCustomModules = customModules && customModules.length > 0;

    const moduleDescriptions = useCustomModules
      ? customModules
          .map(
            (cm) => `- **${cm.title}** (${cm.module_type}): ${cm.description}`,
          )
          .join("\n")
      : includeModules
          .map((module) => {
            const config = BACKBONE_MODULE_CONFIGS[module];
            return `- **${config.label}** (${module}): ${config.description}`;
          })
          .join("\n");

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "backbone_generation",
      {
        modules: moduleDescriptions,
        maxNodesPerModule: maxNodesPerModule.toString(),
      },
      userId,
      graphId,
    );

    if (!systemPrompt || systemPrompt.trim().length === 0) {
      throw new AppError(ErrorCodes.SYSTEM_CONFIGURATION_ERROR, {
        message: "backbone_generation prompt template not found in database",
      });
    }

    return systemPrompt;
  }

  private buildUserPrompt(
    topic: string,
    context?: string,
    includeModules?: BackboneModule[],
    customModules?: BackboneModuleCustomConfig[],
  ): string {
    let prompt = `研究主题：${topic}`;

    if (context && context.trim()) {
      prompt += `\n\n背景信息：\n${context}`;
    }

    if (customModules && customModules.length > 0) {
      const moduleLabels = customModules.map((cm) => cm.title).join("、");
      prompt += `\n\n请为这个研究主题生成包含以下模块的骨干网络：${moduleLabels}`;
    } else if (includeModules && includeModules.length > 0) {
      const moduleLabels = includeModules
        .map((m) => BACKBONE_MODULE_LABELS[m])
        .join("、");
      prompt += `\n\n请为这个研究主题生成包含以下模块的骨干网络：${moduleLabels}`;
    }

    prompt += `\n\n注意：`;
    prompt += `\n1. 只生成 root 和 core 级别的节点，不要生成更细粒度的节点`;
    prompt += `\n2. **每个节点都必须有 description 字段**，描述应该针对具体研究主题，不能使用通用描述`;
    prompt += `\n3. **每个节点都必须有 summary 字段**：20-30字的简短概览，概括该知识点的核心内容，应比标题更具体但比完整内容更精炼`;
    prompt += `\n4. 根节点的描述应该概括该模块或主题的核心内容`;
    prompt += `\n\n请以有效的 json 格式返回结果。`;

    return prompt;
  }

  getModuleConfigs(): Record<
    BackboneModule,
    Omit<BackboneModuleConfig, "module">
  > {
    return BACKBONE_MODULE_CONFIGS;
  }

  getModuleConfig(module: BackboneModule): BackboneModuleConfig {
    return {
      module,
      ...BACKBONE_MODULE_CONFIGS[module],
    };
  }

  getAllModules(): BackboneModuleConfig[] {
    return Object.entries(BACKBONE_MODULE_CONFIGS).map(([module, config]) => ({
      module: module as BackboneModule,
      ...config,
    }));
  }
}

export const backboneNetworkService = new BackboneNetworkService();
