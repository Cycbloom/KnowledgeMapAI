import { getSupabaseAdmin } from "../../supabase";
import { getAIProviderForTask } from "./factory";
import type { AIProvider } from "@shared/types";
import { logger } from "../../utils/logger";
import { promptService } from "./promptService";
import { AppError } from "../../middleware/errorHandler";
import { ErrorCodes } from "../../../shared/types/errorCodes";
import { withAIMonitoring } from "./aiMonitor";
import { withTimeoutAndRetry, LONG_TIMEOUT } from "../../../shared/utils/retry";
import type { RAGSearchResult, RAGResponse } from "./ragService";
import {
  buildGraphMetaContext,
  formatGraphContextBlock,
} from "../graph/graphDisambiguationContext";

export class RAGChatService {

  async chat(
    message: string,
    userId: string,
    buildContext: () => Promise<{ context: string; sources: RAGSearchResult[] }>,
    options: {
      graphId?: string;
      currentNodeId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      sessionId?: string;
      useGraphContext?: boolean;
      graphHops?: number;
      searchMode?: "semantic" | "keyword" | "hybrid";
    } = {},
  ): Promise<RAGResponse> {
    const {
      graphId,
      currentNodeId,
      history = [],
      model,
      language,
      useGraphContext,
      searchMode,
    } = options;

    const { context, sources } = await buildContext();

    const aiProvider = await getAIProviderForTask("text");

    if (!aiProvider.hasKey) {
      return {
        answer: `[模拟回复] 我收到了你的问题: "${message}"。这是一个模拟回复，因为后端没有配置 API Key。`,
        sources: sources.slice(0, 3),
        suggestedQuestions: [
          "这个知识点的核心概念是什么？",
          "有哪些相关的知识点？",
          "如何应用这个知识？",
        ],
      };
    }

    const graphContextHint =
      useGraphContext && graphId && context.includes("[图谱关联节点]")
        ? `\n\n重要提示：以下知识上下文中包含通过图谱关系发现的关联节点（标记为"图谱关联"）。这些节点之间存在图谱关系路径，请利用这些关系进行推理和解释，帮助用户理解知识之间的深层联系。\n`
        : "";

    const supabase = getSupabaseAdmin();
    // 图谱级消歧上下文（best-effort）：注入图谱标题/描述/领域，回答贴合当前图谱语义
    const graphMeta = await buildGraphMetaContext(supabase, graphId);
    const graphMetaBlock = formatGraphContextBlock(graphMeta);

    const systemPrompt =
      (await promptService.getRenderedPrompt(
        supabase,
        "rag_chat",
        {
          context: context || "(暂无相关上下文)",
          graphContextHint,
        },
        undefined,
        graphId,
        language,
      )) + (graphMetaBlock ? `\n\n${graphMetaBlock}` : "");

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    try {
      const completion = await withAIMonitoring(
        {
          operation: "rag_chat",
          provider: aiProvider.providerType,
          model: model || aiProvider.model,
          sessionId: options.sessionId,
          metadata: {
            graphId,
            userId,
            currentNodeId,
            searchMode,
          },
        },
        async () => {
          const result = await withTimeoutAndRetry(
            () =>
              aiProvider.client.chat.completions.create({
                messages,
                model: model || aiProvider.model,
                temperature: 0.7,
                max_tokens: 2000,
              }),
            {
              timeout: LONG_TIMEOUT,
              maxRetries: 3,
              initialDelay: 1000,
              maxDelay: 10000,
            },
          );

          return {
            result,
            usage: result.usage ?? undefined,
          };
        },
      );

      const answer = completion.choices[0].message.content || "";

      const suggestedQuestions = await this.generateSuggestedQuestions(
        message,
        answer,
        sources,
        aiProvider,
        model,
        language,
      );

      return {
        answer,
        sources: sources.slice(0, 8),
        suggestedQuestions,
      };
    } catch (error: unknown) {
      logger.error("RAG Chat Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message: error instanceof Error ? error.message : "RAG chat failed",
      });
    }
  }

  private async generateSuggestedQuestions(
    originalQuestion: string,
    answer: string,
    sources: RAGSearchResult[],
    provider: AIProvider,
    model?: string,
    language?: string,
  ): Promise<string[]> {
    if (sources.length === 0) {
      return [
        "这个知识点的核心概念是什么？",
        "有哪些相关的知识点？",
        "如何应用这个知识？",
      ];
    }

    try {
      const sourceTitles = sources
        .slice(0, 3)
        .map((s) => s.title)
        .join(", ");

      const supabase = getSupabaseAdmin();
      const systemPrompt = await promptService.getRenderedPrompt(
        supabase,
        "suggest_questions",
        { originalQuestion, previousAnswer: answer.substring(0, 500) },
        undefined,
        undefined,
        language,
      );

      const completion = await withAIMonitoring(
        {
          operation: "rag_suggest_questions",
          provider: provider.providerType,
          model: model || provider.model,
        },
        async () => {
          const result = await provider.client.chat.completions.create({
            messages: [
              {
                role: "system",
                content: systemPrompt,
              },
              {
                role: "user",
                content: `原始问题: ${originalQuestion}\n\n回答摘要: ${answer.substring(0, 500)}\n\n相关节点: ${sourceTitles}`,
              },
            ],
            model: model || provider.model,
            response_format: { type: "json_object" },
            max_tokens: 200,
          });

          return {
            result,
            usage: result.usage ?? undefined,
          };
        },
      );

      const content =
        completion.choices[0].message.content || '{"questions": []}';
      const parsed = JSON.parse(content);
      return parsed.questions || [];
    } catch {
      return ["这个知识点的核心概念是什么？", "有哪些相关的知识点？"];
    }
  }

  async streamChat(
    message: string,
    userId: string,
    onChunk: (content: string) => void,
    buildContext: () => Promise<{ context: string; sources: RAGSearchResult[] }>,
    options: {
      graphId?: string;
      currentNodeId?: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      sessionId?: string;
      useGraphContext?: boolean;
      graphHops?: number;
      searchMode?: "semantic" | "keyword" | "hybrid";
    } = {},
  ): Promise<RAGSearchResult[]> {
    const {
      graphId,
      currentNodeId,
      history = [],
      model,
      language,
      useGraphContext,
      searchMode,
    } = options;

    const { context, sources } = await buildContext();

    const aiProvider = await getAIProviderForTask("text");

    if (!aiProvider.hasKey) {
      const mockResponse = `[模拟回复] 我收到了你的问题: "${message}"。这是一个模拟回复，因为后端没有配置 API Key。`;
      for (const char of mockResponse) {
        onChunk(char);
        await new Promise((r) => setTimeout(r, 20));
      }
      return sources.slice(0, 3);
    }

    const graphContextHint =
      useGraphContext && graphId && context.includes("[图谱关联节点]")
        ? `\n\n重要提示：以下知识上下文中包含通过图谱关系发现的关联节点（标记为"图谱关联"）。这些节点之间存在图谱关系路径，请利用这些关系进行推理和解释，帮助用户理解知识之间的深层联系。\n`
        : "";

    const supabase = getSupabaseAdmin();
    // 图谱级消歧上下文（best-effort）：注入图谱标题/描述/领域，回答贴合当前图谱语义
    const graphMeta = await buildGraphMetaContext(supabase, graphId);
    const graphMetaBlock = formatGraphContextBlock(graphMeta);

    const systemPrompt =
      (await promptService.getRenderedPrompt(
        supabase,
        "rag_chat",
        {
          context: context || "(暂无相关上下文)",
          graphContextHint,
        },
        undefined,
        graphId,
        language,
      )) + (graphMetaBlock ? `\n\n${graphMetaBlock}` : "");

    const messages: Array<{
      role: "system" | "user" | "assistant";
      content: string;
    }> = [
      { role: "system", content: systemPrompt },
      ...history.map((h) => ({ role: h.role, content: h.content })),
      { role: "user", content: message },
    ];

    try {
      await withAIMonitoring(
        {
          operation: "rag_stream_chat",
          provider: aiProvider.providerType,
          model: model || aiProvider.model,
          sessionId: options.sessionId,
          metadata: {
            graphId,
            userId,
            currentNodeId,
            searchMode,
          },
        },
        async () => {
          const stream = await aiProvider.client.chat.completions.create({
            messages,
            model: model || aiProvider.model,
            temperature: 0.7,
            max_tokens: 2000,
            stream: true,
            stream_options: { include_usage: true },
          });

          // 防御：上游返回非 SSE（普通 JSON/错误体）时给出可诊断的明确报错，
          // 而不是抛出晦涩的 "is not async iterable"。
          if (
            !stream ||
            typeof (stream as { [Symbol.asyncIterator]?: unknown })[
              Symbol.asyncIterator
            ] !== "function"
          ) {
            logger.error(
              "RAG stream chat: provider did not return a streaming (SSE) response",
              {
                provider: aiProvider.providerType,
                model: model || aiProvider.model,
                responseType: typeof stream,
                responseKeys:
                  stream && typeof stream === "object"
                    ? Object.keys(stream as object)
                    : undefined,
                responseSample: stream
                  ? JSON.stringify(stream).slice(0, 300)
                  : undefined,
              },
            );
            throw new AppError(ErrorCodes.AI_INVALID_RESPONSE, {
              message: `RAG 流式对话：AI 服务未返回流式响应（provider=${aiProvider.providerType}, model=${model || aiProvider.model}），请检查模型是否支持流式输出或 baseURL 是否正确`,
            });
          }

          let promptTokens = 0;
          let completionTokens = 0;
          let cachedTokens = 0;

          try {
            // 最后一个 chunk 携带 usage；持续覆盖以保留最终值
            for await (const chunk of stream) {
              const content = chunk.choices[0]?.delta?.content || "";
              if (content) {
                onChunk(content);
              }
              if (chunk.usage) {
                promptTokens = chunk.usage.prompt_tokens || 0;
                completionTokens = chunk.usage.completion_tokens || 0;
                cachedTokens =
                  chunk.usage.prompt_tokens_details?.cached_tokens || 0;
              }
            }
          } catch (error: unknown) {
            // 已发送的 chunks 无法撤回：停止发送，向上抛错以触发 success: false 上报
            const err = error as Error;
            logger.error(
              `RAG stream chat chunk iteration failed: ${err.message}`,
            );
            throw error;
          }

          return {
            result: undefined,
            usage: {
              prompt_tokens: promptTokens,
              completion_tokens: completionTokens,
              prompt_tokens_details: { cached_tokens: cachedTokens },
            },
          };
        },
      );

      return sources.slice(0, 8);
    } catch (error: unknown) {
      logger.error("RAG Stream Chat Error:", error);
      throw new AppError(ErrorCodes.AI_PROVIDER_ERROR, {
        message:
          error instanceof Error ? error.message : "RAG stream chat failed",
      });
    }
  }
}

export const ragChatService = new RAGChatService();
