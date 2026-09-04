import type { Response } from "express";
import { getAIProviderForTask, getAIProvider } from "./factory";
import type { AIProviderType, AIProvider, ChatCompletionChunk } from "@shared/types";
import type { AuthRequest } from "../../middleware/auth";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { withAIMonitoring } from "./aiMonitor";
import {
  getMockResponse,
} from "./mock";
import {
  withTimeoutAndRetry,
  TimeoutError,
  RetryError,
  DEFAULT_TIMEOUT,
  LONG_TIMEOUT,
} from "../../../shared/utils/retry";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import {
  dedupedRequest,
  generateRequestKey,
} from "./aiUtils";
import { parseAIResponse } from "./utils";
import type { IGraphQueryService } from "./types";
import {
  buildGraphContext,
  buildTutorContext,
} from "./contextBuilder";
import { enrichMetadata } from "./performanceMonitor";
import {
  sendStreamChunk,
  sendStreamDone,
  sendStreamError,
} from "../../routes/ai/utils";

export class ChatService {
  private graphQueryService: IGraphQueryService | null = null;

  /**
   * 注入图谱查询服务，用于解耦 ai 层对 graph 层的直接依赖。
   * 应在 ChatService 实例化后、使用前调用。
   */
  setGraphQueryService(service: IGraphQueryService): void {
    this.graphQueryService = service;
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

        return withAIMonitoring(
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

      return withAIMonitoring(
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

  // === 流式聊天 ===

  private streamMockResponse(res: Response, content: string): void {
    const chunks = content.split("");
    const sendMockChunks = async () => {
      for (const chunk of chunks) {
        sendStreamChunk(res, chunk);
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      sendStreamDone(res);
    };
    sendMockChunks();
  }

  private async streamChatCompletion(
    res: Response,
    provider: AIProvider,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    options: {
      operation: string;
      metadata: Record<string, unknown>;
      sessionId: string;
    },
  ): Promise<void> {
    await withAIMonitoring(
      {
        operation: options.operation,
        provider: provider.providerType,
        model,
        metadata: options.metadata,
        sessionId: options.sessionId,
      },
      async () => {
        // 建立流连接：仅 timeout，不 retry
        // 流式响应不可重试——若首 chunk 后失败，retry 会重新发起请求并再次发送重复内容
        // 通过手动迭代 AsyncIterable + Promise.race 实现逐 chunk 超时保护
        const CHUNK_TIMEOUT_MS = 30000; // 单个 chunk 间隔超时
        const stream = provider.client.chat.completions.create({
            messages,
            model,
            stream: true,
            stream_options: { include_usage: true },
          });

        let inputTokens = 0;
        let outputTokens = 0;
        let cachedInputTokens = 0;

        try {
          // 手动迭代 + 逐 chunk 超时保护
          const iterator = stream[Symbol.asyncIterator]();
          let firstChunk = true;
          while (true) {
            const timeoutMs = firstChunk ? LONG_TIMEOUT : CHUNK_TIMEOUT_MS;
            let result: IteratorResult<ChatCompletionChunk>;
            try {
              result = await Promise.race([
                iterator.next(),
                new Promise<IteratorResult<never>>((_, reject) =>
                  setTimeout(() => reject(new TimeoutError(timeoutMs)), timeoutMs)
                ),
              ]);
            } catch (raceError: unknown) {
              if (raceError instanceof TimeoutError) {
                logger.warn(`${options.operation} stream timed out after ${timeoutMs}ms`);
                res.end();
                throw raceError;
              }
              throw raceError;
            }
            firstChunk = false;
            if (result.done) break;
            const chunk = result.value;

            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              sendStreamChunk(res, content);
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
              cachedInputTokens =
                chunk.usage.prompt_tokens_details?.cached_tokens || 0;
            }
          }
        } catch (error: unknown) {
          // 已发送的 chunks 无法撤回：停止发送，向上抛错以触发 success: false 上报
          const err = error as Error;
          logger.error(
            `${options.operation} stream chunk iteration failed: ${err.message}`,
          );
          throw error;
        }

        return {
          result: undefined,
          usage: {
            prompt_tokens: inputTokens,
            completion_tokens: outputTokens,
            prompt_tokens_details: { cached_tokens: cachedInputTokens },
          },
        };
      },
    );
  }

  /**
   * 通用流式对话（供其它 AI 服务复用）：转发到私有的 streamChatCompletion，
   * 复用 AI 监控 + 逐 chunk 超时保护。非单图上下文场景（如跨图谱目标对话）使用。
   */
  async streamMessages(
    res: Response,
    provider: AIProvider,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    model: string,
    options: {
      operation: string;
      metadata: Record<string, unknown>;
      sessionId: string;
    },
  ): Promise<void> {
    await this.streamChatCompletion(res, provider, messages, model, options);
  }

  async chatStream(
    req: AuthRequest,
    res: Response,
    options: {
      message: string;
      graphId: string;
      contextNodeIds?: string[];
      history?: Array<{ role: string; content: string }>;
      provider?: AIProviderType;
      model?: string;
      language?: string;
      sessionId: string;
    },
  ): Promise<void> {
    try {
      const provider = options.provider
        ? await getAIProvider(options.provider)
        : await getAIProviderForTask("text");

      if (!provider.hasKey) {
        const mockContent = getMockResponse(
          "chat",
          options.message,
        ) as string;
        this.streamMockResponse(res, mockContent);
        return;
      }

      const supabase = req.supabase;
      if (!supabase) {
        sendStreamError(res, "未授权", ErrorCodes.AUTH_UNAUTHORIZED);
        return;
      }

      if (!this.graphQueryService) {
        sendStreamError(res, "图谱服务未配置", ErrorCodes.SYSTEM_INTERNAL_ERROR);
        return;
      }

      const { nodes, edges } = await this.graphQueryService.getGraphNodes(
        supabase,
        req.user.id,
        options.graphId,
      );

      const contextText = buildGraphContext(nodes, edges, {
        contextNodeIds: options.contextNodeIds,
        graphId: options.graphId,
      });

      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "chat",
        { contextText },
        req.user.id,
        options.graphId,
        options.language,
      );

      const messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [
        { role: "system", content: systemPrompt },
        ...(options.history ?? []).map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        })),
        { role: "user", content: options.message },
      ];

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
        graphId: options.graphId,
        userId: req.user.id,
        topic: options.message.slice(0, 50),
      });

      const model = options.model || provider.model;

      await this.streamChatCompletion(res, provider, messages, model, {
        operation: "chat",
        metadata: enrichedMetadata,
        sessionId: options.sessionId,
      });
      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Chat Error:", error);
      sendStreamError(
        res,
        err.message || "AI 对话失败",
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  async tutorChatStream(
    req: AuthRequest,
    res: Response,
    options: {
      message: string;
      graphId?: string;
      contextNodeIds?: string[];
      history?: Array<{ role: string; content: string }>;
      mode?: "free" | "guided";
      provider?: AIProviderType;
      model?: string;
      sessionId: string;
    },
  ): Promise<void> {
    try {
      const provider = options.provider
        ? await getAIProvider(options.provider)
        : await getAIProviderForTask("text");

      if (!provider.hasKey) {
        const mockContent = await this.tutorChat(
          [{ role: "user", content: options.message }],
          { mode: options.mode },
          { provider: options.provider, model: options.model },
        );
        this.streamMockResponse(res, mockContent);
        return;
      }

      let context: {
        mode: string;
        graphId?: string;
        existingNodes?: string[];
        currentNodeId?: string;
        currentNodeTitle?: string;
        currentNodeContent?: string;
      } = { mode: options.mode ?? "free" };

      if (options.graphId) {
        const supabase = req.supabase;
        if (!supabase) {
          sendStreamError(res, "未授权", ErrorCodes.AUTH_UNAUTHORIZED);
          return;
        }
        if (!this.graphQueryService) {
          sendStreamError(res, "图谱服务未配置", ErrorCodes.SYSTEM_INTERNAL_ERROR);
          return;
        }
        const { nodes } = await this.graphQueryService.getGraphNodes(
          supabase,
          req.user.id,
          options.graphId,
        );
        context = buildTutorContext(
          nodes,
          options.contextNodeIds?.[0],
          options.mode ?? "free",
          options.graphId,
        );
      }

      const messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [
        ...(options.history ?? []).map((msg) => ({
          role: msg.role as "user" | "assistant" | "system",
          content: msg.content,
        })),
        { role: "user", content: options.message },
      ];

      const enrichedMetadata = await enrichMetadata(getSupabaseAdmin(), {
        graphId: options.graphId,
        userId: req.user.id,
        topic: options.message.slice(0, 50),
        style: options.mode,
      });

      const systemPrompt = await promptService.getRenderedPrompt(
        getSupabaseAdmin(),
        "tutor_chat",
        {
          isGuided: options.mode === "guided",
          currentNodeId: context.currentNodeId,
          currentNodeTitle: context.currentNodeTitle,
          currentNodeContent: context.currentNodeContent,
          existingNodes: context.existingNodes
            ? context.existingNodes.slice(0, 20).join(", ")
            : undefined,
        },
      );

      const fullMessages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [{ role: "system", content: systemPrompt }, ...messages];

      const model = options.model || provider.model;

      await this.streamChatCompletion(res, provider, fullMessages, model, {
        operation: "tutor_chat",
        metadata: enrichedMetadata,
        sessionId: options.sessionId,
      });
      sendStreamDone(res);
    } catch (error: unknown) {
      const err = error as Error;
      logger.error("AI Tutor Chat Error:", error);
      sendStreamError(
        res,
        err.message || "AI 助教对话失败",
        ErrorCodes.SYSTEM_INTERNAL_ERROR,
      );
    }
  }

  /**
   * 主观题 AI 判分（测验交卷后使用）。
   * 返回：score(0-100)、feedback(评语)、correct(是否判定正确)。
   */
  async gradeAnswer(
    options: {
      question: string;
      cardType: string;
      referenceAnswer: string;
      userAnswer: string;
      explanation?: string;
      difficulty?: string;
      provider?: AIProviderType;
      model?: string;
    },
  ): Promise<{ score: number; feedback: string; correct: boolean }> {
    if (!options.userAnswer || options.userAnswer.trim() === "") {
      return { score: 0, feedback: "未作答", correct: false };
    }

    const systemPrompt = await promptService.getRenderedPrompt(
      getSupabaseAdmin(),
      "grade_answer",
      {
        question: options.question,
        cardType: options.cardType,
        referenceAnswer: options.referenceAnswer,
        userAnswer: options.userAnswer,
        explanation: options.explanation || "",
        difficulty: options.difficulty || "medium",
      },
    );

    const raw = await this.chat(
      [{ role: "system", content: systemPrompt }],
      {
        provider: options.provider,
        model: options.model,
        timeout: LONG_TIMEOUT,
        operation: "grade_answer",
      },
    );

    let parsed: { score?: number; feedback?: string; correct?: boolean };
    try {
      parsed = parseAIResponse<{ score?: number; feedback?: string; correct?: boolean }>(
        raw,
        "grade_answer",
      );
    } catch {
      return { score: 50, feedback: "AI 评分未能解析，请人工核对参考答案。", correct: false };
    }

    const score = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
    const correct = parsed.correct === true || score >= 60;
    const feedback = (parsed.feedback || "").trim() || "已完成评分。";

    return { score, feedback, correct };
  }
}

export const chatService = new ChatService();
