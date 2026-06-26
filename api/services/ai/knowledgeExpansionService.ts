import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { cacheService, CacheKeys } from "../common/cacheService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse } from "./utils";
import { withAIMonitoring } from "./aiMonitor";
import {
  getMockResponse,
  getMockBranchSuggestions,
  getMockNextTopics,
} from "./mock";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  LONG_TIMEOUT,
} from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

// Fallback system prompt for suggestNextTopic.
// Used when the database does not contain a prompt with key "suggest_next_topic".
// TODO: 迁移此 prompt 到数据库后可移除此常量
const SUGGEST_NEXT_TOPIC_FALLBACK_PROMPT =
  "You are an expert knowledge tutor. Based on the current node and user's learning progress, suggest 2-3 next topics to explore.\n" +
  "Return a JSON object with a 'suggestions' array. Each object must have:\n" +
  "- 'title': Brief topic title (max 30 chars)\n" +
  "- 'description': Short explanation (max 80 chars)\n" +
  "- 'priority': 'high', 'medium', or 'low'\n" +
  "- 'estimatedDifficulty': Number from 1-5\n" +
  "Please respond in Chinese.";

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
      userId?: string;
      graphId?: string;
      language?: string;
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return getMockResponse("expand", nodeTitle) as { suggestions: unknown[] };
    }

    const cacheKey = CacheKeys.AI_EXPAND(
      nodeTitle,
      options.contextLevel || "normal",
    );
    const cached = await cacheService.get<{ suggestions: unknown[] }>(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const model = options.model || provider.model;

      return withAIMonitoring(
        {
          operation: "expandKnowledge",
          provider: provider.providerType,
          model,
          metadata: {
            graphId: options.graphId,
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
            customPrompt: options.expandPrompt,
            nodeTitle,
            nodeContent: nodeContent || "",
            existingNodes: existingNodesContext,
            childrenContext,
            isRootOrCore: ["root", "core"].includes(contextLevel),
            isLeaf: contextLevel === "leaf",
          };

          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "expand_knowledge",
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
                    content: `Node Title: ${nodeTitle}\nNode Content: ${
                      nodeContent || ""
                    }${existingNodesContext}${childrenContext}`,
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
                  `Expand Knowledge retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const content = completion.choices[0].message.content || "";

          if (!content || content.trim() === "") {
            logger.error(
              "[AI] Empty response from AI provider for expandKnowledge",
            );
            const mockResult = getMockResponse("expand", nodeTitle) as {
              suggestions: unknown[];
            };
            return { result: mockResult, usage: completion.usage };
          }

          const parsed = parseAIResponse<{ suggestions: unknown[] }>(
            content,
            "Expand Knowledge",
          );
          const result = { suggestions: parsed.suggestions || parsed };

          await cacheService.set(cacheKey, result, 60 * 60 * 24);

          return { result, usage: completion.usage };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }

      if (err.message?.includes("parse") || err.message?.includes("JSON")) {
        logger.warn("[AI] Returning mock response due to parse error");
        return getMockResponse("expand", nodeTitle) as {
          suggestions: unknown[];
        };
      }

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
              nodeTitle: nodeTitle,
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
              nodeTitle: nodeTitle,
            },
          },
          async () => {
            const progressContext = options.userProgress
              ? `\nUser Progress:\n- Mastered nodes: ${options.userProgress.masteredCount || 0}\n- Current level: ${options.userProgress.currentLevel || "beginner"}`
              : "";

            // 优先从数据库读取 prompt，若不存在则使用 fallback 常量
            let systemPrompt = await promptService.getRenderedPrompt(
              getSupabaseAdmin(),
              "suggest_next_topic",
              {},
            );

            if (!systemPrompt || systemPrompt.trim().length === 0) {
              systemPrompt = SUGGEST_NEXT_TOPIC_FALLBACK_PROMPT;
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
