import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import type { Keyword } from "@shared/types/graph";
import { getProviderForTask } from "./config";
import { promptService } from "./promptService";
import { cacheService, CacheKeys } from "../common/cacheService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { parseAIResponse, buildTutorContext } from "./utils";
import { performanceMonitor } from "./performanceMonitor";
import { pricingService } from "./pricingService";
import { withEmbeddingMonitoring } from "./aiMonitor";
import {
  getMockResponse,
  getMockCards,
  getMockBranchSuggestions,
  getMockConcepts,
  getMockNextTopics,
  getMockImageGraph,
} from "./mock";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
  LONG_TIMEOUT,
} from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";

function isEnglishLanguage(language?: string): boolean {
  if (!language) return false;
  return language === "en-US" || language === "en" || language.startsWith("en");
}

interface PerformanceTrackingOptions {
  operation: string;
  provider: AIProviderType;
  model: string;
  sessionId?: string;
  metadata?: {
    graphId?: string;
    nodeId?: string;
    userId?: string;
    topic?: string;
    text?: string;
    graph1?: string;
    graph2?: string;
    title?: string;
    nodeTitle?: string;
  };
}

function extractTokenUsage(
  usage:
    | {
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
      }
    | undefined,
): {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  uncachedInputTokens: number;
  reasoningTokens: number;
} {
  const inputTokens = usage?.prompt_tokens || 0;
  const outputTokens = usage?.completion_tokens || 0;
  const cachedInputTokens = usage?.prompt_tokens_details?.cached_tokens || 0;

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens,
    uncachedInputTokens: Math.max(0, inputTokens - cachedInputTokens),
    reasoningTokens: usage?.completion_tokens_details?.reasoning_tokens || 0,
  };
}

async function withPerformanceTracking<T>(
  options: PerformanceTrackingOptions,
  fn: () => Promise<{
    result: T;
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
  }>,
): Promise<T> {
  const startTime = Date.now();
  let success = true;
  let errorMessage: string | undefined;
  let inputTokens = 0;
  let outputTokens = 0;
  let cachedInputTokens = 0;
  let uncachedInputTokens = 0;
  let reasoningTokens = 0;

  try {
    const { result, usage } = await fn();
    const tokenUsage = extractTokenUsage(usage);
    inputTokens = tokenUsage.inputTokens;
    outputTokens = tokenUsage.outputTokens;
    cachedInputTokens = tokenUsage.cachedInputTokens;
    uncachedInputTokens = tokenUsage.uncachedInputTokens;
    reasoningTokens = tokenUsage.reasoningTokens;
    return result;
  } catch (error: unknown) {
    success = false;
    const err = error as Error;
    errorMessage = err.message;
    throw error;
  } finally {
    const duration = Date.now() - startTime;
    const totalTokens = inputTokens + outputTokens;
    const cacheHitRate =
      inputTokens > 0 ? (cachedInputTokens / inputTokens) * 100 : 0;

    const costBreakdown = pricingService.calculateDetailedCost(
      options.provider,
      options.model,
      inputTokens,
      outputTokens,
      cachedInputTokens,
    );

    performanceMonitor.recordLog({
      operation: options.operation,
      provider: options.provider,
      model: options.model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost: costBreakdown.totalCost,
      duration,
      success,
      errorMessage,
      metadata: options.metadata,
      sessionId: options.sessionId,

      cachedInputTokens,
      uncachedInputTokens,
      reasoningTokens,
      cacheHitRate: parseFloat(cacheHitRate.toFixed(2)),
      costBreakdown,
    });
  }
}

const pendingRequests = new Map<string, Promise<unknown>>();

async function dedupedRequest<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const pending = pendingRequests.get(key) as Promise<T> | undefined;
  if (pending) {
    logger.debug(`Reusing pending request for key: ${key}`);
    return pending;
  }

  const promise = fn().finally(() => pendingRequests.delete(key));
  pendingRequests.set(key, promise);
  return promise;
}

function generateRequestKey(
  operation: string,
  params: Record<string, unknown>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((k) => `${k}=${JSON.stringify(params[k])}`)
    .join("&");
  return `${operation}:${sortedParams}`;
}

export type CardDifficulty = "easy" | "medium" | "hard" | "mixed";

export interface GenerateLearningMaterialResult {
  content: string;
  keywords: Keyword[];
}

export interface GenerateCardsOptions {
  type?: string;
  types?: string[];
  count?: number;
  context?: string;
  provider?: AIProviderType;
  model?: string;
  userId?: string;
  graphId?: string;
  pack_type?: string;
  difficulty?: CardDifficulty;
  language?: string;
}

export class AIService {
  async generateEmbedding(text: string): Promise<number[] | null> {
    const embeddingProvider = await getProviderForTask("embedding");

    if (!embeddingProvider) {
      logger.warn("No embedding provider available");
      return null;
    }

    const provider = await getAIProviderForTask("embedding");

    if (!provider.hasKey) {
      logger.warn("Embedding provider has no API key configured");
      return null;
    }

    try {
      if (provider.createEmbedding) {
        return await withEmbeddingMonitoring(
          {
            operation: "generate_embedding",
            provider: provider.providerType,
            model: provider.embeddingModel || provider.model,
          },
          async () => ({
            result: await provider.createEmbedding!(text),
            tokenCount: text.length,
          }),
        );
      }

      return await withEmbeddingMonitoring(
        {
          operation: "generate_embedding",
          provider: provider.providerType,
          model: provider.embeddingModel || provider.model,
        },
        async () => {
          const response = await provider.client.embeddings.create({
            model: provider.embeddingModel || provider.model,
            input: text,
          });
          return {
            result: response.data[0].embedding as number[],
            tokenCount: text.length,
          };
        },
      );
    } catch (error) {
      logger.error("Failed to generate embedding:", error);
      return null;
    }
  }

  async generateEmbeddingsBatch(texts: string[]): Promise<(number[] | null)[]> {
    const embeddingProvider = await getProviderForTask("embedding");
    if (!embeddingProvider) {
      logger.warn(
        "No embedding provider configured. Set embedding_ai.provider in system_config or EMBEDDING_PROVIDER env var.",
      );
      return texts.map(() => null);
    }

    const provider = await getAIProviderForTask("embedding");

    if (!provider.hasKey) {
      logger.warn(
        `Embedding provider "${embeddingProvider}" has no API key configured.`,
      );
      return texts.map(() => null);
    }

    if (texts.length === 0) {
      return [];
    }

    try {
      if (provider.createEmbedding) {
        const concurrencyLimit = 5;
        const results: (number[] | null)[] = new Array(texts.length).fill(null);

        for (let i = 0; i < texts.length; i += concurrencyLimit) {
          const batch = texts.slice(i, i + concurrencyLimit);
          const batchResults = await Promise.all(
            batch.map((text) =>
              withEmbeddingMonitoring(
                {
                  operation: "generate_embedding_batch",
                  provider: provider.providerType,
                  model: provider.embeddingModel || provider.model,
                  metadata: { batchCount: batch.length },
                },
                async () => ({
                  result: await provider.createEmbedding!(text),
                  tokenCount: text.length,
                }),
              ).catch(() => null),
            ),
          );

          for (let j = 0; j < batch.length; j++) {
            results[i + j] = batchResults[j];
          }

          if (i + concurrencyLimit < texts.length) {
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }

        return results;
      }

      return await withEmbeddingMonitoring(
        {
          operation: "generate_embedding_batch",
          provider: provider.providerType,
          model: provider.embeddingModel || provider.model,
          metadata: { batchCount: texts.length },
        },
        async () => {
          const response = await provider.client.embeddings.create({
            model: provider.embeddingModel || provider.model,
            input: texts,
          });

          const results: (number[] | null)[] = new Array(texts.length).fill(
            null,
          );
          for (const item of response.data) {
            results[item.index] = item.embedding;
          }

          return {
            result: results,
            tokenCount: texts.reduce((sum, t) => sum + t.length, 0),
          };
        },
      );
    } catch (error) {
      logger.error("Failed to generate embeddings batch:", error);
      return texts.map(() => null);
    }
  }

  async chat(
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options: {
      provider?: AIProviderType;
      model?: string;
      timeout?: number;
      sessionId?: string;
      operation?: string;
    } = {},
  ): Promise<string> {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      const response = getMockResponse(
        "chat",
        messages[messages.length - 1].content,
      );
      return typeof response === "string" ? response : JSON.stringify(response);
    }

    const requestKey = generateRequestKey("chat", {
      model: options.model || provider.model,
      lastMessage: messages[messages.length - 1].content.slice(0, 100),
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withPerformanceTracking(
          {
            operation: options.operation || "chat",
            provider: provider.providerType,
            model,
            sessionId: options.sessionId,
          },
          async () => {
            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages,
                  model,
                }),
              {
                timeout: options.timeout || DEFAULT_TIMEOUT,
                maxRetries: 3,
                onRetry: (attempt, error) => {
                  logger.warn(
                    `Chat request retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            return {
              result: completion.choices[0].message.content || "",
              usage: completion.usage,
            };
          },
        );
      });
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Chat Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI chat failed",
      });
    }
  }

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

  async generateCards(
    topic: string,
    content: string,
    options: GenerateCardsOptions = {},
  ) {
    const types = options.type
      ? [options.type]
      : options.types || ["qa", "choice"];
    const count = options.count || 3;
    const context = options.context;

    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return { cards: getMockCards(topic, types, count) };
    }

    const requestKey = generateRequestKey("generateCards", {
      topic: topic.slice(0, 100),
      types: types.sort(),
      count,
      difficulty: options.difficulty || "medium",
      model: options.model || provider.model,
    });

    const typePrompts: Record<string, string> = {
      qa: "For 'qa' type: Create thought-provoking open-ended questions that test deep understanding.",
      choice:
        "For 'choice' type: Create multiple-choice questions with 4 plausible options.",
      true_false:
        "For 'true_false' type: Create statements focusing on common misconceptions.",
      multi_choice:
        "For 'multi_choice' type: Create multiple-choice questions where ONE OR MORE options can be correct.",
      fill_in_the_blank:
        "For 'fill_in_the_blank' type: Create a sentence with '___' as blanks. Return valid JSON.",
      essay:
        "For 'essay' type: Create complex questions requiring a long-form structured answer.",
    };

    const difficultyPrompts: Record<string, string> = {
      easy: `Difficulty Level: EASY
- Focus on basic concept recognition and memory recall
- Questions should directly test knowledge point definitions and basic facts
- Use straightforward language without complex scenarios
- For choice questions: distractors should be clearly distinguishable from the correct answer
- For QA questions: answers should be brief and directly stated in the source material`,
      medium: `Difficulty Level: MEDIUM
- Focus on understanding and application of concepts
- Questions should require comprehension, not just memorization
- Include simple scenarios or examples to test understanding
- For choice questions: distractors should be plausible but distinguishable with good understanding
- For QA questions: answers may require synthesizing information from multiple parts`,
      hard: `Difficulty Level: HARD
- Focus on analysis, synthesis, and complex problem-solving
- Questions should require deep understanding and connecting multiple concepts
- Include complex scenarios, edge cases, or require multi-step reasoning
- For choice questions: all options should be plausible, requiring careful analysis
- For QA questions: answers should demonstrate comprehensive understanding with examples`,
      mixed: `Difficulty Level: MIXED
- Generate questions with varying difficulty levels (easy, medium, hard)
- Distribute difficulty evenly across the generated cards
- Include a mix of memory recall, understanding, and analytical questions`,
    };

    const difficulty = options.difficulty || "medium";

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withPerformanceTracking(
          {
            operation: "generateCards",
            provider: provider.providerType,
            model,
            metadata: {
              graphId: options.graphId,
              userId: options.userId,
            },
          },
          async () => {
            const typeToPromptCode: Record<string, string> = {
              qa: "generate_cards_qa",
              choice: "generate_cards_choice",
              true_false: "generate_cards_true_false",
              multi_choice: "generate_cards_multi_choice",
              fill_in_the_blank: "generate_cards_fill_blank",
              essay: "generate_cards_essay",
            };
            const promptParts = await Promise.all(
              types.map(async (type) => {
                const code = typeToPromptCode[type] ?? `generate_cards_${type}`;
                const rendered = await promptService.getRenderedPrompt(
                  getSupabaseAdmin(),
                  code,
                  { count: Math.ceil(count / types.length), difficulty },
                  options.userId,
                  options.graphId,
                  options.language,
                );

                if (rendered && rendered.trim().length > 0) {
                  return rendered;
                }

                return typePrompts[type] || "";
              }),
            );

            let systemPrompt = promptParts
              .filter((p) => p.length > 0)
              .join("\n\n---\n\n");

            const difficultyInstruction =
              difficultyPrompts[difficulty] || difficultyPrompts.medium;

            if (!systemPrompt.trim()) {
              systemPrompt = await promptService.getRenderedPrompt(
                getSupabaseAdmin(),
                "generate_cards",
                {
                  count,
                  allowedTypes: types.join(", "),
                  context: context ? `Parent/Context Info: ${context}` : "",
                  difficulty,
                },
                options.userId,
                options.graphId,
                options.language,
              );
            } else {
              const typeRestriction =
                types.length === 1
                  ? `CRITICAL: ONLY generate cards of type '${types[0]}'. DO NOT generate any other types.`
                  : `Allowed card types: ${types.join(", ")}. Only generate these types.`;

              systemPrompt = `You are an educational expert. Generate ${count} flashcards based on the provided topic.

${typeRestriction}

${difficultyInstruction}

Context: ${context || "None"}\n\n${systemPrompt}

Please respond with a valid JSON object.`;
            }

            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    { role: "system", content: systemPrompt },
                    {
                      role: "user",
                      content: `Topic: ${topic}\nContent: ${
                        content || "No detailed content provided."
                      }`,
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
                    `Generate Cards retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const result = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{ cards: unknown[] }>(
              result,
              "Generate Cards",
            );

            let cards = parsed.cards || [];
            const originalCount = cards.length;

            if (originalCount > 0) {
              cards = cards.filter((card: any) => {
                const cardType = card.type;
                return types.includes(cardType);
              });

              const filteredCount = cards.length;
              if (filteredCount !== originalCount) {
                logger.warn(
                  `[Generate Cards] Filtered cards: requested types [${types.join(", ")}], ` +
                    `got ${originalCount}, kept ${filteredCount}`,
                );
              }
            }

            return { result: { cards }, usage: completion.usage };
          },
        );
      });
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
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI card generation failed",
      });
    }
  }

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

      return withPerformanceTracking(
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

        return withPerformanceTracking(
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

  async generateGraphFromImage(
    imageBase64: string,
    options: { provider?: AIProviderType; model?: string } = {},
  ) {
    let providerName = options.provider;

    if (!providerName) {
      const defaultTextProvider = await getAIProviderForTask("text");
      if (defaultTextProvider.providerType === "deepseek") {
        providerName = "aliyun";
      } else {
        providerName = defaultTextProvider.providerType;
      }
    }

    const provider = await getAIProvider(providerName as AIProviderType);

    if (!provider.hasKey) {
      return getMockImageGraph();
    }

    let model = options.model || provider.model;
    if (provider.providerType === "aliyun" && !model.includes("vl")) {
      model = "qwen-vl-max";
    }

    try {
      return withPerformanceTracking(
        {
          operation: "generateGraphFromImage",
          provider: provider.providerType,
          model,
        },
        async () => {
          const completion = await provider.client.chat.completions.create({
            messages: [
              {
                role: "system",
                content: `You are a knowledge graph expert capable of analyzing visual content.
                
Your task:
1. Analyze the provided image to extract the structured knowledge hierarchy.
2. Output a JSON object with 'nodes' and 'edges' arrays.
   - Nodes: { "id": "temp_id", "title": "Title", "content": "Description", "level": "root|core|sub|normal|leaf" }
   - Edges: { "source": "parent_id", "target": "child_id", "relationship": "contains|related" }
3. Limit to 30-50 nodes.
4. Respond in Chinese.`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Please analyze this image and generate the knowledge graph JSON.",
                  },
                  { type: "image_url", image_url: { url: imageBase64 } },
                ],
              },
            ],
            model,
            response_format: { type: "json_object" },
            max_tokens: 4000,
          });

          const content = completion.choices[0].message.content || "";
          const result = parseAIResponse<{
            nodes: unknown[];
            edges: unknown[];
          }>(content, "Image to Graph");

          return {
            result,
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("Image-to-Graph Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "Image processing failed",
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

        return withPerformanceTracking(
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

        return withPerformanceTracking(
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

            const completion = await provider.client.chat.completions.create({
              messages: [
                {
                  role: "system",
                  content:
                    "You are an expert knowledge tutor. Based on the current node and user's learning progress, suggest 2-3 next topics to explore.\n" +
                    "Return a JSON object with a 'suggestions' array. Each object must have:\n" +
                    "- 'title': Brief topic title (max 30 chars)\n" +
                    "- 'description': Short explanation (max 80 chars)\n" +
                    "- 'priority': 'high', 'medium', or 'low'\n" +
                    "- 'estimatedDifficulty': Number from 1-5\n" +
                    "Please respond in Chinese.",
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

  async tutorChat(
    messages: Array<{ role: string; content: string }>,
    context: {
      graphId?: string;
      currentNodeId?: string;
      currentNodeTitle?: string;
      currentNodeContent?: string;
      existingNodes?: string[];
      userProgress?: { masteredCount?: number; dueCount?: number };
      mode?: "free" | "guided";
      learningPath?: string[];
    } = {},
    options: { provider?: AIProviderType; model?: string } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      const lastMessage = messages[messages.length - 1];
      return `[模拟助教回复] 我收到了你的消息: "${
        lastMessage?.content || ""
      }"。这是一个模拟回复，因为后端没有配置 API Key。`;
    }

    try {
      const model = options.model || provider.model;

      return withPerformanceTracking(
        {
          operation: "tutorChat",
          provider: provider.providerType,
          model,
          metadata: {
            graphId: context.graphId,
            nodeId: context.currentNodeId,
          },
        },
        async () => {
          const contextText = buildTutorContext(context);
          const modePrompt =
            context.mode === "guided"
              ? "Guided Mode: Follow a structured learning path. Guide the user step-by-step."
              : "Free Mode: Allow open-ended discussion. Answer questions freely.";

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content: `You are an intelligent knowledge tutor for a Knowledge Graph application.

${modePrompt}

Current Context:
${contextText}

Instructions:
1. Be conversational and engaging
2. Use markdown formatting for better readability
3. When explaining concepts, provide examples
4. Respond in the same language as the user (default to Chinese)
5. All mathematical formulas must be wrapped in LaTeX: $inline$ or $$block$$`,
                  },
                  ...messages.map((msg) => ({
                    role: msg.role as "user" | "assistant" | "system",
                    content: msg.content,
                  })),
                ],
                model,
              }),
            {
              timeout: DEFAULT_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Tutor Chat retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          return {
            result: completion.choices[0].message.content || "",
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Tutor Chat Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI tutor chat failed",
      });
    }
  }

  async extractConcepts(
    text: string,
    existingNodes?: string[],
    options: {
      provider?: AIProviderType;
      model?: string;
      maxConcepts?: number;
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return { concepts: getMockConcepts() };
    }

    const requestKey = generateRequestKey("extractConcepts", {
      text: text.slice(0, 200),
      maxConcepts: options.maxConcepts || 5,
      model: options.model || provider.model,
    });

    try {
      return await dedupedRequest(requestKey, async () => {
        const model = options.model || provider.model;

        return withPerformanceTracking(
          {
            operation: "extractConcepts",
            provider: provider.providerType,
            model,
            metadata: {
              text: text.slice(0, 100) + (text.length > 100 ? "..." : ""),
            },
          },
          async () => {
            const existingNodesContext =
              existingNodes && existingNodes.length > 0
                ? `\nExisting Nodes (DO NOT duplicate these): ${existingNodes
                    .slice(0, 50)
                    .join(", ")}`
                : "";

            const maxConcepts = options.maxConcepts || 5;

            const completion = await withTimeoutAndRetry(
              () =>
                provider.client.chat.completions.create({
                  messages: [
                    {
                      role: "system",
                      content: `You are a concept extraction expert. Analyze the given text and extract key concepts.

Requirements:
1. Extract ${maxConcepts} most important concepts
2. Each concept should be a standalone knowledge point
3. Avoid duplicating existing nodes
4. Provide a brief description for each concept
5. Assign a priority level based on importance

Return a JSON object with a 'concepts' array. Each object must have:
- 'title': Concept name (max 20 chars)
- 'description': Brief explanation (max 100 chars)
- 'priority': 'high', 'medium', or 'low'

Please respond in Chinese.`,
                    },
                    {
                      role: "user",
                      content: `Text to analyze:\n${text}${existingNodesContext}`,
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
                    `Extract Concepts retry attempt ${attempt}: ${error.message}`,
                  );
                },
              },
            );

            const content = completion.choices[0].message.content || "";
            const parsed = parseAIResponse<{ concepts: unknown[] }>(
              content,
              "Extract Concepts",
            );

            return {
              result: { concepts: parsed.concepts || [] },
              usage: completion.usage,
            };
          },
        );
      });
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
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI concept extraction failed",
      });
    }
  }

  async analyzeCrossGraphConnections(
    graph1: {
      id: string;
      title?: string;
      nodes: Array<{ id: string; title: string; content?: string }>;
    },
    graph2: {
      id: string;
      title?: string;
      nodes: Array<{ id: string; title: string; content?: string }>;
    },
    options: {
      provider?: AIProviderType;
      model?: string;
      userId?: string;
      language?: string;
    } = {},
  ) {
    const provider = options.provider
      ? await getAIProvider(options.provider)
      : await getAIProviderForTask("text");

    if (!provider.hasKey) {
      return {
        connections: [],
        summary: {
          total_connections: 0,
          by_type: {
            same_concept: 0,
            related_concept: 0,
            complementary: 0,
            prerequisite: 0,
          },
          overall_relationship: "需要配置 AI API Key 才能分析连接",
        },
      };
    }

    try {
      const model = options.model || provider.model;

      return withPerformanceTracking(
        {
          operation: "analyzeCrossGraphConnections",
          provider: provider.providerType,
          model,
          metadata: {
            graph1: graph1.title || "图谱 1",
            graph2: graph2.title || "图谱 2",
            userId: options.userId,
          },
        },
        async () => {
          const graph1NodesText = graph1.nodes
            .slice(0, 50)
            .map(
              (n) =>
                `- Title: ${n.title}${
                  n.content ? `, Content: ${n.content.slice(0, 200)}...` : ""
                }`,
            )
            .join("\n");

          const graph2NodesText = graph2.nodes
            .slice(0, 50)
            .map(
              (n) =>
                `- Title: ${n.title}${
                  n.content ? `, Content: ${n.content.slice(0, 200)}...` : ""
                }`,
            )
            .join("\n");

          const templateContext = {
            graph1Title: graph1.title || "图谱 1",
            graph2Title: graph2.title || "图谱 2",
            graph1Description: "",
            graph2Description: "",
            graph1Nodes: graph1NodesText,
            graph2Nodes: graph2NodesText,
          };

          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "cross_graph_connection_analysis",
            templateContext,
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
                    content: `请分析这两个图谱之间的节点连接关系。`,
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
                  `Cross Graph Connections retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          const content = completion.choices[0].message.content || "";
          const result = parseAIResponse<{
            connections: Array<{
              node1_title: string;
              node2_title: string;
              connection_type: string;
              similarity: number;
              reason: string;
            }>;
            summary: {
              total_connections: number;
              by_type: Record<string, number>;
              overall_relationship: string;
            };
          }>(content, "Cross Graph Connections");

          return {
            result,
            usage: completion.usage,
          };
        },
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Cross Graph Connections Error:", error);

      if (err instanceof TimeoutError) {
        throw new AppError(ErrorCodes.AI_TIMEOUT);
      }
      if (err instanceof RetryError) {
        throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
          message: `AI 请求失败，已重试 ${err.attempts} 次: ${err.lastError.message}`,
        });
      }
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: err.message || "AI 跨图谱连接分析失败",
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

        return withPerformanceTracking(
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

export const aiService = new AIService();
