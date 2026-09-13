import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { cacheService, CacheKeys } from "../common/cacheService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import {
  getMockBranchSuggestions,
  getMockNextTopics,
} from "./mock";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import {
  resolveLocalizedText,
  type LocalizedText,
} from "@shared/utils/localization";
import {
  withTimeoutAndRetry,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { generateChildSuggestions } from "./nodeSuggestionService";
import { buildGraphMetaContext } from "../graph/graphDisambiguationContext";

export class KnowledgeExpansionService {
  async expandKnowledge(
    nodeTitle: string,
    nodeContent?: string,
    existingNodes?: string[],
    childNodes?: string[],
    options: {
      provider?: AIProviderType;
      model?: string;
      contextLevel?: string;
      expandPrompt?: string;
      minCount?: number;
      maxCount?: number;
      useLevelStrategy?: boolean;
      userId?: string;
      graphId?: string;
      language?: string;
    } = {},
  ) {
    const cacheKey = CacheKeys.AI_EXPAND(
      nodeTitle,
      options.contextLevel || "normal",
      options.graphId,
    );

    try {
      return await cacheService.getOrSet<{ suggestions: unknown[] }>(
        cacheKey,
        async () => {
          // 消歧上下文：同步链路无 node_id，仅注入图谱级元数据（best-effort）
          const disambiguation = await buildGraphMetaContext(
            getSupabaseAdmin(),
            options.graphId,
          );

          const result = await generateChildSuggestions(getSupabaseAdmin(), {
            nodeTitle,
            nodeContent,
            nodeLevel: options.contextLevel,
            existingChildren: childNodes,
            existingNodes,
            customPrompt: options.expandPrompt,
            minCount: options.minCount ?? 3,
            maxCount: options.maxCount ?? 8,
            useLevelStrategy: options.useLevelStrategy,
            providerType: options.provider,
            model: options.model,
            language: options.language,
            userId: options.userId,
            graphId: options.graphId,
            allowMock: true,
            disambiguation,
          });

          return { suggestions: result.children };
        },
        60 * 60 * 24,
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);
      if (err instanceof AppError) throw err;
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI expansion failed",
      });
    }
  }

  async getBranchSuggestions(
    nodeTitle: string,
    nodeContent?: string,
    existingNodes?: string[],
    childNodes?: string[],
    options: {
      provider?: AIProviderType;
      model?: string;
      contextLevel?: string;
      userId?: string;
      graphId?: string;
      language?: string;
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return { suggestions: getMockBranchSuggestions(nodeTitle) };
    }

    const requestKey = generateRequestKey("getBranchSuggestions", {
      nodeTitle: nodeTitle.slice(0, 100),
      contextLevel: options.contextLevel || "normal",
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "getBranchSuggestions",
            provider: provider.providerType,
            model,
            metadata: {
              nodeTitle,
              userId: options.userId,
            },
          },
          async () => {
            const existingNodesContext =
              existingNodes && existingNodes.length > 0
                ? `\nExisting Nodes in Graph: ${existingNodes
                    .slice(0, 300)
                    .join(", ")}`
                : "";

            const childrenContext =
              childNodes && childNodes.length > 0
                ? `\nCurrent Direct Children (DO NOT suggest these): ${childNodes.join(
                    ", ",
                  )}`
                : "";

            const contextLevel = options.contextLevel || "normal";

            const templateContext = {
              nodeTitle,
              nodeContent: nodeContent || "",
              existingNodes: existingNodesContext,
              childrenContext,
              isRootOrCore: ["root", "core"].includes(contextLevel),
              isLeaf: contextLevel === "leaf",
            };

            const systemPrompt = await promptService.getRenderedPrompt(
              getSupabaseAdmin(),
              "branch_suggestions",
              templateContext,
              options.userId,
              options.graphId,
              options.language,
            );

            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: `Node Title: ${nodeTitle}\nNode Content: ${nodeContent || ""}${existingNodesContext}${childrenContext}`,
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
                    `Branch Suggestions retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const content = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{ suggestions: unknown[] }>(
              content,
              "Branch Suggestions",
            );

            return {
              result: { suggestions: parsed.suggestions || [] },
              usage: completion.usage,
            };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI branch suggestions failed",
      });
    }
  }

  async suggestNextTopic(
    nodeTitle: string,
    nodeContent?: string,
    _existingNodes?: string[],
    options: {
      provider?: AIProviderType;
      model?: string;
      userId?: string;
      userProgress?: {
        masteredCount?: number;
        currentLevel?: string;
        dueCount?: number;
      };
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return { suggestions: getMockNextTopics(nodeTitle) };
    }

    const requestKey = generateRequestKey("suggestNextTopic", {
      nodeTitle: nodeTitle.slice(0, 100),
      masteredCount: options.userProgress?.masteredCount || 0,
      currentLevel: options.userProgress?.currentLevel || "beginner",
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withAIMonitoring(
          {
            operation: "suggestNextTopic",
            provider: provider.providerType,
            model,
            metadata: {
              nodeTitle,
            },
          },
          async () => {
            const progress = await this.resolveUserProgress(
              options.userId,
              options.userProgress,
            );
            const progressLines = [
              `- Mastered nodes: ${progress.masteredCount} / ${progress.totalNodes}`,
              `- Average mastery: ${progress.averageMastery}`,
              `- Current level: ${progress.currentLevel}`,
              `- Due reviews: ${progress.dueCount}`,
              ...(progress.weakTopics.length > 0
                ? [`- Weak topics (lowest mastery): ${progress.weakTopics.join(", ")}`]
                : []),
            ];
            const progressContext = `\nUser Progress:\n${progressLines.join("\n")}`;

            // Fetch the prompt from the database (DB is the single source of truth)
            const systemPrompt = await promptService.getRenderedPrompt(
              getSupabaseAdmin(),
              "suggest_next_topic",
              {},
            );

            if (!systemPrompt || systemPrompt.trim().length === 0) {
              throw new AppError(ErrorCodes.SYSTEM_CONFIGURATION_ERROR, {
                message: "suggest_next_topic prompt template not found in database",
              });
            }

            const completion = await provider.client.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content: systemPrompt,
                },
                {
                  role: "user",
                  content: `Current Node:\nTitle: ${nodeTitle}\nContent: ${nodeContent || ""}${progressContext}`,
                },
              ],
              model,
              response_format: { type: "json_object" },
            });

            const content = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{ suggestions: unknown[] }>(
              content,
              "Suggest Next Topic",
            );

            return {
              result: { suggestions: parsed.suggestions || [] },
              usage: completion.usage,
            };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI suggestion failed",
      });
    }
  }

  /**
   * 解析用户真实学习进度（掌握度驱动推荐的权威数据源）。
   *
   * - 有 userId：从 knowledge_points.mastery_level（FSRS 派生）与
   *   study_cards.next_review 实时聚合：掌握节点数/平均掌握度/低掌握度弱项/到期复习；
   * - 无 userId 或查询失败：回退到调用方传入的 userProgress（或全零默认）。
   */
  private async resolveUserProgress(
    userId?: string,
    userProgress?: {
      masteredCount?: number;
      currentLevel?: string;
      dueCount?: number;
    },
  ): Promise<ResolvedUserProgress> {
    const fallback: ResolvedUserProgress = {
      masteredCount: userProgress?.masteredCount ?? 0,
      totalNodes: 0,
      averageMastery: 0,
      currentLevel: userProgress?.currentLevel ?? "beginner",
      dueCount: userProgress?.dueCount ?? 0,
      weakTopics: [],
    };
    if (!userId) return fallback;

    try {
      const admin = getSupabaseAdmin();
      const [kpRes, dueRes] = await Promise.all([
        admin
          .from("knowledge_points")
          .select("title, mastery_level")
          .eq("owner_id", userId),
        admin
          .from("study_cards")
          .select("id", { count: "exact", head: true })
          .eq("user_id", userId)
          .lte("next_review", new Date().toISOString()),
      ]);

      if (kpRes.error) {
        logger.warn(
          "[suggestNextTopic] failed to fetch knowledge points:",
          kpRes.error,
        );
        return fallback;
      }

      const kps = (kpRes.data ?? []) as {
        title?: LocalizedText;
        mastery_level?: number;
      }[];
      const totalNodes = kps.length;
      const masteredCount = kps.filter(
        (k) => (k.mastery_level ?? 0) >= 0.65,
      ).length;
      const averageMastery = totalNodes
        ? Math.round(
            (kps.reduce((sum, k) => sum + (k.mastery_level ?? 0), 0) /
              totalNodes) *
              100,
          ) / 100
        : 0;
      const weakTopics = kps
        .filter((k) => (k.mastery_level ?? 0) < 0.45)
        .sort((a, b) => (a.mastery_level ?? 0) - (b.mastery_level ?? 0))
        .slice(0, 8)
        .map((k) => resolveLocalizedText(k.title, "zh-CN"))
        .filter((title) => title.trim().length > 0);

      return {
        masteredCount,
        totalNodes,
        averageMastery,
        currentLevel: this.mapMasteryToLevel(averageMastery),
        dueCount: dueRes.count ?? 0,
        weakTopics,
      };
    } catch (error) {
      logger.warn("[suggestNextTopic] failed to resolve user progress:", error);
      return fallback;
    }
  }

  /** 平均掌握度 → 学习阶段（与 masteryThresholds 档位对齐） */
  private mapMasteryToLevel(avg: number): string {
    if (avg >= 0.82) return "advanced";
    if (avg >= 0.65) return "proficient";
    if (avg >= 0.45) return "intermediate";
    if (avg >= 0.25) return "familiar";
    return "beginner";
  }
}

interface ResolvedUserProgress {
  masteredCount: number;
  totalNodes: number;
  averageMastery: number;
  currentLevel: string;
  dueCount: number;
  weakTopics: string[];
}

export const knowledgeExpansionService = new KnowledgeExpansionService();
