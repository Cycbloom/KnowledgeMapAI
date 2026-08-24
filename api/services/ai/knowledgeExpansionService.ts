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
  withTimeoutAndRetry,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { generateChildSuggestions } from "./nodeSuggestionService";

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
    );

    try {
      return await cacheService.getOrSet<{ suggestions: unknown[] }>(
        cacheKey,
        async () => {
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
      userProgress?: { masteredCount?: number; currentLevel?: string };
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
            const progressContext = options.userProgress
              ? `\nUser Progress:\n- Mastered nodes: ${options.userProgress.masteredCount || 0}\n- Current level: ${options.userProgress.currentLevel || "beginner"}`
              : "";

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
}

export const knowledgeExpansionService = new KnowledgeExpansionService();
