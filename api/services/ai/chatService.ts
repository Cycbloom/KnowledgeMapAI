import type { Response } from "express";
import { getAIProviderForTask, getAIProvider } from "./factory";
import { webSearch, hasWebSearchKey } from "./webSearchService";
import type { AIProviderType, AIProvider, ChatCompletionChunk, ChatCompletionUsage } from "@shared/types";
import type { AuthRequest } from "../../middleware/auth";
import { promptService } from "./promptService";
import { getSupabaseAdmin } from "../../supabase";
import { logger } from "../../utils/logger";
import { withAIMonitoring } from "./aiMonitor";
import { WEB_SEARCH_SYSTEM_HINT } from "@shared/template/injections";
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

// ── 联网搜索（Function Calling）相关常量 ──────────────────────────────
const MAX_TOOL_ROUNDS = 6; // 单次对话最多工具调用轮次，防止死循环

const webSearchTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "联网搜索互联网获取实时、最新或超出模型知识范围的信息。适合查询最新新闻、时效性数据、实时资讯、外部网站内容等。",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "搜索关键词，应简洁并涵盖关键实体与限定词",
        },
      },
      required: ["query"],
    },
  },
} as const;

// 附加到 system prompt 末尾，让模型知道具备联网能力并主动调用（shared/template/injections）

// 工具调用的消息元素（assistant / tool role）
interface ToolRoleMessage {
  role: "assistant" | "tool";
  content: string | null;
  tool_call_id?: string;
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
}

type ChatMessageLike =
  | import("@shared/types").ChatCompletionMessage
  | ToolRoleMessage
  | { role: "user" | "system"; content: string };

// 流式 chunk 中累积出的单个 tool_call（未被引用时删除以确保无未用声明）
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
      enableWebSearch?: boolean;
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

    // 联网搜索：仅当显式开启且已配置搜索 Key 时，走工具调用循环
    if (
      options.enableWebSearch === true &&
      (await hasWebSearchKey().catch(() => false))
    ) {
      const result = await this.chatWithTools(provider, messages, {
        model: options.model || provider.model,
        operation: options.operation || "chat",
        timeout: options.timeout,
      });
      return result;
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
    options: { provider?: AIProviderType; model?: string; language?: string } = {},
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
            undefined,
            undefined,
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

  // === 联网搜索工具调用（非流式） ===

  /**
   * 非流式工具调用循环：发送带 tools 的请求 → 若模型返回 tool_calls 则执行
   * web_search 并以 tool role 回灌 → 再次请求，直至模型返回纯文本答案。
   */
  private async chatWithTools(
    provider: AIProvider,
    messages: Array<{ role: "user" | "assistant" | "system"; content: string }>,
    options: { model: string; operation: string; timeout?: number },
  ): Promise<string> {
    const working: ChatMessageLike[] = [...messages];
    const webSearchQueries: string[] = [];
    // 用可变引用承载计数，循环内更新，withAIMonitoring 的 finally 读取到最终值
    const toolMetadata: Record<string, unknown> = {
      webSearchCount: 0,
      webSearchQueries,
    };

    return withAIMonitoring(
      {
        operation: options.operation,
        provider: provider.providerType,
        model: options.model,
        metadata: toolMetadata,
      },
      async () => {
        let finalUsage: ChatCompletionUsage | undefined;

        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const completion = await withTimeoutAndRetry(
            () =>
              provider.client.chat.completions.create({
                messages: working,
                model: options.model,
                tools: [webSearchTool],
              }),
            {
              timeout: options.timeout || DEFAULT_TIMEOUT,
              maxRetries: 3,
              onRetry: (attempt, error) => {
                logger.warn(
                  `Chat(web) retry attempt ${attempt}: ${error.message}`,
                );
              },
            },
          );

          finalUsage = completion.usage;
          const message = completion.choices[0]?.message;
          const toolCalls = message?.tool_calls;

          if (toolCalls && toolCalls.length) {
            working.push({
              role: "assistant",
              content: message.content ?? null,
              tool_calls: toolCalls,
            });
            for (const toolCall of toolCalls) {
              const result = await this.executeToolCall(
                {
                  id: toolCall.id,
                  name: toolCall.function.name,
                  arguments: toolCall.function.arguments,
                },
                webSearchQueries,
              );
              working.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: result,
              });
            }
            toolMetadata.webSearchCount = webSearchQueries.length;
            continue;
          }

          return { result: message?.content ?? "", usage: finalUsage };
        }

        throw new AppError(ErrorCodes.AI_TIMEOUT, {
          message: "联网对话在多次工具调用后仍未结束",
        });
      },
    );
  }

  /** 执行单个工具调用。目前仅支持 web_search，其余工具返回错误提示给模型。
   *  collector 用于收集实际执行的联网查询词，供 AI 监控记录展示。 */
  private async executeToolCall(
    toolCall: {
      id: string;
      name: string;
      arguments: string;
    },
    collector?: string[],
  ): Promise<string> {
    if (toolCall.name !== "web_search") {
      return `工具 ${toolCall.name} 不存在`;
    }
    let args: { query?: string } = {};
    try {
      args = JSON.parse(toolCall.arguments || "{}") as { query?: string };
    } catch {
      // 解析失败则用空查询，走默认搜索
    }
    collector?.push(args.query ?? "");
    try {
      return await webSearch(args.query ?? "");
    } catch (error) {
      return `联网搜索失败：${(error as Error).message}`;
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
      enableWebSearch?: boolean;
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
        const hasTools = options.enableWebSearch === true;
        // 可变的工具调用上下文：联网场景下会在各轮间追加 assistant/tool 消息
        const working: ChatMessageLike[] = [...messages];
        const webSearchQueries: string[] = [];
        let inputTokens = 0;
        let outputTokens = 0;
        let cachedInputTokens = 0;

        // ─── 消耗单轮流式响应的迭代器（含逐 chunk 超时保护）───
        // 返回本轮累积的 tool_calls 分片 + 对外可见的文本内容。
        // 工具轮次中的中间文本被丢弃，只有无工具调用的最终轮才对外输出。
        const consumeStreamRound = async (): Promise<{
          toolCalls: Array<{
            index: number;
            id?: string;
            name?: string;
            args?: string;
          }>;
          content: string;
        }> => {
          // 必须 await：openai SDK 的 create() 返回 Promise<Stream>（APIPromise），
          // 不 await 拿到的是 Promise 而非 AsyncIterable，迭代会报
          // "stream[Symbol.asyncIterator] is not a function"。
          const rawStream: unknown = await provider.client.chat.completions.create({
            messages: working,
            model,
            stream: true,
            stream_options: { include_usage: true },
            ...(hasTools ? { tools: [webSearchTool] } : {}),
          });

          // 防御：上游返回非 SSE（普通 JSON/错误体）时给出可诊断的明确报错，
          // 而不是抛出晦涩的 "is not a function"。
          if (
            !rawStream ||
            typeof (rawStream as { [Symbol.asyncIterator]?: unknown })[
              Symbol.asyncIterator
            ] !== "function"
          ) {
            logger.error(
              `${options.operation} provider did not return a streaming (SSE) response`,
              {
                provider: provider.providerType,
                model,
                responseType: typeof rawStream,
                responseKeys:
                  rawStream && typeof rawStream === "object"
                    ? Object.keys(rawStream as object)
                    : undefined,
                responseSample: rawStream
                  ? JSON.stringify(rawStream).slice(0, 300)
                  : undefined,
              },
            );
            throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, {
              message: `${options.operation}: AI 服务未返回流式响应（provider=${provider.providerType}, model=${model}），请检查模型是否支持流式输出或 baseURL 是否正确`,
            });
          }
          const stream = rawStream as AsyncIterable<ChatCompletionChunk>;

          const toolCallPieceByIdx = new Map<
            number,
            { id?: string; name?: string; args?: string }
          >();
          let content = "";

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
                logger.warn(
                  `${options.operation} stream timed out after ${timeoutMs}ms`,
                );
                res.end();
                throw raceError;
              }
              throw raceError;
            }
            firstChunk = false;
            if (result.done) break;
            const chunk = result.value;
            const delta = chunk.choices[0]?.delta;

            if (delta?.content) {
              content += delta.content;
            }
            // 流式 tool_calls 是分片下发的：按 index 归并 id/name/arguments
            if (delta?.tool_calls) {
              for (const piece of delta.tool_calls) {
                if (piece.index == null) continue;
                const entry = toolCallPieceByIdx.get(piece.index) ?? {};
                if (piece.id) entry.id = piece.id;
                if (piece.function?.name) entry.name = piece.function.name;
                if (piece.function?.arguments) {
                  entry.args = (entry.args ?? "") + piece.function.arguments;
                }
                toolCallPieceByIdx.set(piece.index, entry);
              }
            }
            if (chunk.usage) {
              inputTokens = chunk.usage.prompt_tokens || 0;
              outputTokens = chunk.usage.completion_tokens || 0;
              cachedInputTokens =
                chunk.usage.prompt_tokens_details?.cached_tokens || 0;
            }
          }

          return {
            toolCalls: [...toolCallPieceByIdx.entries()]
              .sort((a, b) => a[0] - b[0])
              .map(([index, entry]) => ({
                index,
                id: entry.id,
                name: entry.name ?? "web_search",
                args: entry.args ?? "{}",
              })),
            content,
          };
        };

        try {
          // 外层工具调用循环：联网场景下模型可能先返回 tool_calls，需执行搜索后回灌再续答
          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const { toolCalls, content } = await consumeStreamRound();

            if (hasTools && toolCalls.length > 0) {
              const assistantToolCalls = toolCalls.map((tc, idx) => ({
                id: tc.id ?? `call_${round}_${idx}`,
                type: "function" as const,
                function: { name: tc.name ?? "web_search", arguments: tc.args ?? "{}" },
              }));
              working.push({
                role: "assistant",
                content: null,
                tool_calls: assistantToolCalls,
              });
              // 工具调用可能并行多个，顺序执行 web_search 并回灌结果
              for (const toolCall of assistantToolCalls) {
                const result = await this.executeToolCall(
                  {
                    id: toolCall.id,
                    name: toolCall.function.name,
                    arguments: toolCall.function.arguments,
                  },
                  webSearchQueries,
                );
                working.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  content: result,
                });
              }
              // 丢弃工具轮次的中间文本，进入下一轮
              continue;
            }

            // 无工具调用：将本轮内容实时转发给前端
            if (content) {
              sendStreamChunk(res, content);
            }
            break;
          }
        } catch (error: unknown) {
          // 已发送的 chunks 无法撤回：停止发送，向上抛错以触发 success: false 上报
          const err = error as Error;
          logger.error(
            `${options.operation} stream chunk iteration failed: ${err.message}`,
          );
          throw error;
        }

        // 把联网搜索次数写入监控 metadata，前端性能页可展示
        if (webSearchQueries.length > 0) {
          (options.metadata as Record<string, unknown>).webSearchCount =
            webSearchQueries.length;
          (options.metadata as Record<string, unknown>).webSearchQueries =
            webSearchQueries;
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
      enableWebSearch?: boolean;
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

      // 联网搜索开关：已配置搜索 Key 时注入 web_search 工具并在系统提示中声明
      const enableWebSearch = await hasWebSearchKey().catch(() => false);

      const messages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [
        {
          role: "system",
          content: enableWebSearch
            ? `${systemPrompt}${WEB_SEARCH_SYSTEM_HINT}`
            : systemPrompt,
        },
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
        enableWebSearch,
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
      language?: string;
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
          { provider: options.provider, model: options.model, language: options.language },
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
        undefined,
        undefined,
        options.language,
      );

      const enableWebSearch = await hasWebSearchKey().catch(() => false);

      const fullMessages: Array<{
        role: "user" | "assistant" | "system";
        content: string;
      }> = [
        {
          role: "system",
          content: enableWebSearch
            ? `${systemPrompt}${WEB_SEARCH_SYSTEM_HINT}`
            : systemPrompt,
        },
        ...messages,
      ];

      const model = options.model || provider.model;

      await this.streamChatCompletion(res, provider, fullMessages, model, {
        operation: "tutor_chat",
        metadata: enrichedMetadata,
        sessionId: options.sessionId,
        enableWebSearch,
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
      language?: string;
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
      undefined,
      undefined,
      options.language,
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
