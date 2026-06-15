import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType } from "@shared/types";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import {
  withAIPerformanceTracking,
} from "./utils";
import {
  getMockResponse,
} from "./mock";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
} from "../../utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";

export class ChatService {
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

        return withAIPerformanceTracking(
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

      return withAIPerformanceTracking(
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
          // 使用 promptService 获取渲染后的 system prompt（从数据库读取）
          const systemPrompt = await promptService.getRenderedPrompt(
            getSupabaseAdmin(),
            "tutor_chat",
            {
              isGuided: context.mode === "guided",
              currentNodeId: context.currentNodeId,
              currentNodeTitle: context.currentNodeTitle,
              currentNodeContent: context.currentNodeContent,
              existingNodes: context.existingNodes
                ? context.existingNodes.join(", ")
                : undefined,
            },
          );

          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: [
                  {
                    role: "system",
                    content: systemPrompt,
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
}

export const chatService = new ChatService();
