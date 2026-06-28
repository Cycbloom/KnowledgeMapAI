import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { type Response } from "express";
import type { AIProvider } from "@shared/types";

// Mock factory 模块：chatService.chat 通过 getAIProvider/getAIProviderForTask 获取 provider。
// 必须在 chatService import 之前完成 mock 注册（vi.mock 会被 vitest 提升）。
vi.mock("../../../services/ai/factory", () => ({
  getAIProvider: vi.fn(),
  getAIProviderForTask: vi.fn(),
}));

// Mock documentParsingService：其内部 require("pdf-parse") 在模块加载时触发 pdfjs-dist，
// 而 pdfjs-dist 依赖 DOMMatrix（jsdom 环境不提供），导致 ReferenceError。
// chatService 不直接依赖 documentParsingService，仅通过 ai/index barrel 间接加载。
vi.mock("../../../services/ai/documentParsingService", () => ({
  documentParsingService: {
    parseDocument: vi.fn(),
    parsePdf: vi.fn(),
    parseDocx: vi.fn(),
  },
  DocumentParsingService: class MockDocumentParsingService {},
}));

import { chatService } from "../../../services/ai/chatService";
import * as factory from "../../../services/ai/factory";
import { performanceMonitor } from "../../../services/ai/performanceMonitor";
import {
  buildGraphContext,
  buildTutorContext,
  type GraphNode,
  type GraphEdge,
} from "../../../services/ai/contextBuilder";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";

/**
 * 创建 mock AIProvider。
 * hasKey=true 表示已配置 API key，会走真实 provider 路径。
 */
const createMockProvider = (
  overrides: Partial<AIProvider> & { hasKey?: boolean } = {},
): AIProvider => {
  const base = {
    hasKey: true,
    model: "test-model",
    providerType: "openai" as const,
    client: {
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
      embeddings: {
        create: vi.fn(),
      },
    },
  };
  return { ...base, ...overrides } as unknown as AIProvider;
};

/**
 * 创建 mock Express Response，记录所有 write/end 调用以便断言。
 * sendStreamChunk 内部调用 res.write(`data: ${JSON.stringify({ content })}\n\n`)。
 */
const createMockResponse = (): Response & {
  chunks: string[];
  writes: string[];
} => {
  const writes: string[] = [];
  const chunks: string[] = [];
  const res = {
    write: vi.fn((data: string) => {
      writes.push(data);
      // 解析 SSE data 行以提取 content
      const match = /data: (.*)/.exec(data);
      if (match) {
        try {
          const parsed = JSON.parse(match[1]) as { content?: string };
          if (parsed.content) {
            chunks.push(parsed.content);
          }
        } catch {
          // 非 JSON（如 [DONE]），忽略
        }
      }
      return true;
    }),
    end: vi.fn(),
    setHeader: vi.fn(),
    get: vi.fn(),
  };
  return { ...res, chunks, writes } as unknown as Response & {
    chunks: string[];
    writes: string[];
  };
};

/**
 * 创建 mock 流式 async iterable。
 * OpenAI SDK 的 stream:true 返回值实现了 Symbol.asyncIterator。
 */
const createMockStream = <T>(items: T[]): { [Symbol.asyncIterator](): AsyncIterator<T> } => {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        next(): Promise<IteratorResult<T>> {
          if (index < items.length) {
            return Promise.resolve({ value: items[index++], done: false });
          }
          return Promise.resolve({ value: undefined, done: true });
        },
      };
    },
  };
};

describe("ChatService", () => {
  let recordLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on recordLog 并替换为空实现，避免触发数据库持久化等副作用
    recordLogSpy = vi
      .spyOn(performanceMonitor, "recordLog")
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    recordLogSpy.mockRestore();
    vi.restoreAllMocks();
  });

  // ============================================================
  // chat() 方法测试
  // ============================================================
  describe("chat()", () => {
    it("基本路径：provider 有 key 时返回 AI 响应内容", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Hello from AI" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      const result = await chatService.chat([
        { role: "user", content: "Hi" },
      ]);

      expect(result).toBe("Hello from AI");
      expect(mockProvider.client.chat.completions.create).toHaveBeenCalledTimes(1);
    });

    it("provider 无 key 时返回 mock 响应", async () => {
      const mockProvider = createMockProvider({ hasKey: false });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      const result = await chatService.chat([
        { role: "user", content: "What is AI?" },
      ]);

      // getMockResponse("chat", ...) 返回模拟回复字符串
      expect(typeof result).toBe("string");
      expect(result).toContain("What is AI?");
      expect(mockProvider.client.chat.completions.create).not.toHaveBeenCalled();
    });

    it("指定 provider 时调用 getAIProvider 而非 getAIProviderForTask", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Deepseek response" } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      });
      vi.mocked(factory.getAIProvider).mockResolvedValue(mockProvider);

      const result = await chatService.chat(
        [{ role: "user", content: "Hello deepseek" }],
        { provider: "deepseek" },
      );

      expect(factory.getAIProvider).toHaveBeenCalledWith("deepseek");
      expect(factory.getAIProviderForTask).not.toHaveBeenCalled();
      expect(result).toBe("Deepseek response");
    });

    it("未指定 provider 时调用 getAIProviderForTask('text')", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Default response" } }],
        usage: { prompt_tokens: 8, completion_tokens: 4 },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      await chatService.chat([{ role: "user", content: "Hi default" }]);

      expect(factory.getAIProviderForTask).toHaveBeenCalledWith("text");
    });

    it("指定 model 时使用该 model 调用 completions.create", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Custom model response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      await chatService.chat(
        [{ role: "user", content: "Hi custom model" }],
        { model: "gpt-4-turbo" },
      );

      expect(mockProvider.client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: "gpt-4-turbo" }),
      );
    });

    it("未指定 model 时使用 provider 默认 model", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Response" } }],
        usage: { prompt_tokens: 5, completion_tokens: 3 },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      await chatService.chat([
        { role: "user", content: "Hi default model" },
      ]);

      expect(mockProvider.client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ model: "test-model" }),
      );
    });

    it("monitoring 被触发：withAIMonitoring 调用 performanceMonitor.recordLog", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "Monitored response" } }],
        usage: {
          prompt_tokens: 15,
          completion_tokens: 8,
          prompt_tokens_details: { cached_tokens: 5 },
        },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      await chatService.chat(
        [{ role: "user", content: "Monitor this" }],
        { sessionId: "session-123", operation: "chat" },
      );

      // withAIMonitoring 在 finally 块中调用 recordLog
      expect(recordLogSpy).toHaveBeenCalledTimes(1);
      const logCall = recordLogSpy.mock.calls[0][0];
      expect(logCall.operation).toBe("chat");
      expect(logCall.provider).toBe("openai");
      expect(logCall.model).toBe("test-model");
      expect(logCall.sessionId).toBe("session-123");
      expect(logCall.success).toBe(true);
      expect(logCall.inputTokens).toBe(15);
      expect(logCall.outputTokens).toBe(8);
      expect(logCall.cachedInputTokens).toBe(5);
    });

    it("monitoring 失败时也记录 recordLog（success=false）", async () => {
      const mockProvider = createMockProvider();
      // 不可重试的错误，导致 withRetry 立即失败
      mockProvider.client.chat.completions.create.mockRejectedValue(
        new Error("Invalid API key format"),
      );
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      await expect(
        chatService.chat([{ role: "user", content: "Trigger error" }]),
      ).rejects.toThrow();

      expect(recordLogSpy).toHaveBeenCalledTimes(1);
      const logCall = recordLogSpy.mock.calls[0][0];
      expect(logCall.success).toBe(false);
      expect(logCall.errorMessage).toContain("Invalid API key format");
    });

    it("AI 请求失败时抛出 AppError(AI_PROVIDER_ERROR)", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockRejectedValue(
        new Error("Invalid API key"),
      );
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      try {
        await chatService.chat([{ role: "user", content: "Fail case" }]);
        expect.fail("应抛出 AppError");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        expect(appError.code).toBe(ErrorCodes.AI_PROVIDER_ERROR);
      }
    });

    it("返回空 content 时 fallback 为空字符串", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: null } }],
        usage: { prompt_tokens: 5, completion_tokens: 0 },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      const result = await chatService.chat([
        { role: "user", content: "Empty content test" },
      ]);

      expect(result).toBe("");
    });

    it("传递完整的 messages 数组给 completions.create", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue({
        choices: [{ message: { content: "OK" } }],
        usage: { prompt_tokens: 10, completion_tokens: 2 },
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(mockProvider);

      const messages = [
        { role: "system" as const, content: "You are helpful" },
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there" },
        { role: "user" as const, content: "Bye" },
      ];

      await chatService.chat(messages);

      expect(mockProvider.client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({ messages }),
      );
    });
  });

  // ============================================================
  // streamChatCompletion() 流式路径测试
  // streamChatCompletion 为 private 方法，通过类型断言访问以做单元隔离测试。
  // ============================================================
  describe("streamChatCompletion()", () => {
    // 类型辅助：访问 private 方法
    const getStreamChatCompletion = () =>
      (chatService as unknown as {
        streamChatCompletion: (
          res: Response,
          provider: AIProvider,
          messages: Array<{
            role: "user" | "assistant" | "system";
            content: string;
          }>,
          model: string,
          options: {
            operation: string;
            metadata: Record<string, unknown>;
            sessionId: string;
          },
        ) => Promise<void>;
      }).streamChatCompletion.bind(chatService);

    it("流式建立后通过 onChunk（sendStreamChunk）逐 chunk 发送", async () => {
      const mockProvider = createMockProvider();
      const chunks = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: " " } }] },
        { choices: [{ delta: { content: "World" } }] },
        { choices: [{ delta: {} }] },
      ];
      mockProvider.client.chat.completions.create.mockResolvedValue(
        createMockStream(chunks),
      );

      const res = createMockResponse();
      const messages = [{ role: "user" as const, content: "Hi" }];

      await getStreamChatCompletion()(res, mockProvider, messages, "test-model", {
        operation: "chat",
        metadata: {},
        sessionId: "session-stream-1",
      });

      // sendStreamChunk 应为每个有 content 的 chunk 调用一次（3 次）
      expect(res.write).toHaveBeenCalledTimes(3 + 0); // 3 content chunks，无 [DONE]（由调用方发送）
      // 验证发送的内容拼接为 "Hello World"
      // 注意：sendStreamChunk 写入 `data: {"content":"..."}\n\n`，createMockResponse 已解析为 chunks
      const mockRes = res as unknown as { chunks: string[] };
      expect(mockRes.chunks).toEqual(["Hello", " ", "World"]);
    });

    it("流式调用使用 stream:true 与 stream_options 参数", async () => {
      const mockProvider = createMockProvider();
      mockProvider.client.chat.completions.create.mockResolvedValue(
        createMockStream([{ choices: [{ delta: { content: "x" } }] }]),
      );

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "Hi" }],
        "test-model",
        {
          operation: "chat",
          metadata: {},
          sessionId: "session-stream-2",
        },
      );

      expect(mockProvider.client.chat.completions.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          stream_options: { include_usage: true },
        }),
      );
    });

    it("chunk 无 content 时不调用 sendStreamChunk", async () => {
      const mockProvider = createMockProvider();
      const chunks = [
        { choices: [{ delta: {} }] },
        { choices: [{ delta: { content: "only-this" } }] },
        { choices: [{ delta: null }] },
      ];
      mockProvider.client.chat.completions.create.mockResolvedValue(
        createMockStream(chunks),
      );

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "Hi" }],
        "test-model",
        {
          operation: "chat",
          metadata: {},
          sessionId: "session-stream-3",
        },
      );

      expect(res.write).toHaveBeenCalledTimes(1);
      const mockRes = res as unknown as { chunks: string[] };
      expect(mockRes.chunks).toEqual(["only-this"]);
    });

    it("usage 统计从最后一个 chunk 提取并记录到 monitoring", async () => {
      const mockProvider = createMockProvider();
      const chunks = [
        { choices: [{ delta: { content: "response" } }] },
        {
          choices: [{ delta: {} }],
          usage: {
            prompt_tokens: 25,
            completion_tokens: 12,
            prompt_tokens_details: { cached_tokens: 8 },
          },
        },
      ];
      mockProvider.client.chat.completions.create.mockResolvedValue(
        createMockStream(chunks),
      );

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "Hi usage" }],
        "test-model",
        {
          operation: "chat",
          metadata: { graphId: "g-1" },
          sessionId: "session-usage",
        },
      );

      // withAIMonitoring 在 finally 中调用 recordLog
      expect(recordLogSpy).toHaveBeenCalledTimes(1);
      const logCall = recordLogSpy.mock.calls[0][0];
      expect(logCall.inputTokens).toBe(25);
      expect(logCall.outputTokens).toBe(12);
      expect(logCall.cachedInputTokens).toBe(8);
      expect(logCall.operation).toBe("chat");
      expect(logCall.sessionId).toBe("session-usage");
      expect(logCall.success).toBe(true);
    });

    it("无 usage chunk 时 token 统计为 0", async () => {
      const mockProvider = createMockProvider();
      const chunks = [{ choices: [{ delta: { content: "no usage" } }] }];
      mockProvider.client.chat.completions.create.mockResolvedValue(
        createMockStream(chunks),
      );

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "Hi no usage" }],
        "test-model",
        {
          operation: "chat",
          metadata: {},
          sessionId: "session-no-usage",
        },
      );

      expect(recordLogSpy).toHaveBeenCalledTimes(1);
      const logCall = recordLogSpy.mock.calls[0][0];
      expect(logCall.inputTokens).toBe(0);
      expect(logCall.outputTokens).toBe(0);
      expect(logCall.cachedInputTokens).toBe(0);
    });

    it("流式迭代错误时上报 success=false 并重新抛出", async () => {
      const mockProvider = createMockProvider();
      // 创建一个迭代时会抛错的 stream
      const failingStream = {
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<unknown>> {
              return Promise.reject(new Error("stream iteration failed"));
            },
          };
        },
      };
      mockProvider.client.chat.completions.create.mockResolvedValue(
        failingStream,
      );

      const res = createMockResponse();

      await expect(
        getStreamChatCompletion()(
          res,
          mockProvider,
          [{ role: "user", content: "Hi fail" }],
          "test-model",
          {
            operation: "chat",
            metadata: {},
            sessionId: "session-fail",
          },
        ),
      ).rejects.toThrow("stream iteration failed");

      // withAIMonitoring 在 finally 中记录失败
      expect(recordLogSpy).toHaveBeenCalledTimes(1);
      const logCall = recordLogSpy.mock.calls[0][0];
      expect(logCall.success).toBe(false);
      expect(logCall.errorMessage).toContain("stream iteration failed");
    });
  });

  // ============================================================
  // contextBuilder 函数测试（Task 4 迁出的纯函数）
  // ============================================================
  describe("contextBuilder", () => {
    describe("buildGraphContext()", () => {
      it("指定 contextNodeIds 时仅返回选中节点及其内部边", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Node 1", content: "Content 1" },
          { id: "n2", title: "Node 2", content: "Content 2" },
          { id: "n3", title: "Node 3", content: "Content 3" },
        ];
        const edges: GraphEdge[] = [
          {
            source_knowledge_point_id: "n1",
            target_knowledge_point_id: "n2",
            relationship: "related-to",
          },
          {
            source_knowledge_point_id: "n2",
            target_knowledge_point_id: "n3",
            relationship: "leads-to",
          },
          // 这条边连接 n1-n3，但 n3 不在选中列表，应被过滤
          {
            source_knowledge_point_id: "n1",
            target_knowledge_point_id: "n3",
            relationship: "mentions",
          },
        ];

        const result = buildGraphContext(nodes, edges, {
          contextNodeIds: ["n1", "n2"],
        });

        expect(result).toContain("Selected Nodes");
        expect(result).toContain("[Node] Node 1: Content 1");
        expect(result).toContain("[Node] Node 2: Content 2");
        expect(result).not.toContain("Node 3");
        // 仅 n1-n2 这条边两端都在选中列表内
        expect(result).toContain("Node 1 -> Node 2 (related-to)");
        expect(result).not.toContain("leads-to");
        expect(result).not.toContain("mentions");
      });

      it("未指定 contextNodeIds 且节点数 ≤100 时返回所有节点与边", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Alpha", content: "Alpha content" },
          { id: "n2", title: "Beta", content: "Beta content" },
        ];
        const edges: GraphEdge[] = [
          {
            source_knowledge_point_id: "n1",
            target_knowledge_point_id: "n2",
            relationship: "depends-on",
          },
        ];

        const result = buildGraphContext(nodes, edges);

        expect(result).toContain("All Nodes");
        expect(result).toContain("[Node] Alpha: Alpha content");
        expect(result).toContain("[Node] Beta: Beta content");
        expect(result).toContain("All Relationships");
        expect(result).toContain("Alpha -> Beta (depends-on)");
      });

      it("节点数 >100 时仅返回节点标题概览", () => {
        const nodes: (GraphNode | null)[] = Array.from({ length: 101 }, (_, i) => ({
          id: `n${i}`,
          title: `Title ${i}`,
          content: `Content ${i}`,
        }));
        const edges: GraphEdge[] = [];

        const result = buildGraphContext(nodes, edges);

        expect(result).toContain("Graph Overview (Nodes Only)");
        expect(result).toContain("- Title 0");
        expect(result).toContain("- Title 100");
        // 概览模式不输出节点内容
        expect(result).not.toContain("[Node]");
        expect(result).not.toContain("Content 0");
      });

      it("超长上下文按 maxContextLength 截断", () => {
        const longContent = "A".repeat(20000);
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Big", content: longContent },
        ];
        const edges: GraphEdge[] = [];

        const result = buildGraphContext(nodes, edges, { maxContextLength: 100 });

        expect(result.length).toBeLessThanOrEqual(120); // 100 + "...(truncated)"
        expect(result).toContain("(truncated)");
      });

      it("节点 content 为 null 时 fallback 到 '(No content)'", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "NoContent", content: null },
        ];
        const edges: GraphEdge[] = [];

        const result = buildGraphContext(nodes, edges);

        expect(result).toContain("[Node] NoContent: (No content)");
      });

      it("过滤 null 节点", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Valid", content: "Valid" },
          null,
          { id: "n2", title: "AlsoValid", content: "Also valid" },
        ];
        const edges: GraphEdge[] = [];

        const result = buildGraphContext(nodes, edges);

        expect(result).toContain("[Node] Valid: Valid");
        expect(result).toContain("[Node] AlsoValid: Also valid");
        // null 节点不会导致崩溃
        expect(result).not.toContain("null");
        expect(result).not.toContain("undefined");
      });

      it("edge relationship 为 null 时 fallback 到 'related'", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "A", content: "a" },
          { id: "n2", title: "B", content: "b" },
        ];
        const edges: GraphEdge[] = [
          {
            source_knowledge_point_id: "n1",
            target_knowledge_point_id: "n2",
            relationship: null,
          },
        ];

        const result = buildGraphContext(nodes, edges);

        expect(result).toContain("A -> B (related)");
      });

      it("边引用不存在的节点时 title fallback 到 'Unknown'", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Known", content: "known" },
        ];
        const edges: GraphEdge[] = [
          {
            source_knowledge_point_id: "n1",
            target_knowledge_point_id: "missing-id",
            relationship: "points-to",
          },
        ];

        const result = buildGraphContext(nodes, edges);

        expect(result).toContain("Known -> Unknown (points-to)");
      });
    });

    describe("buildTutorContext()", () => {
      it("指定 graphId 与 currentNodeId 时返回完整 tutor 上下文", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Concept A", content: "Content A" },
          { id: "n2", title: "Concept B", content: "Content B" },
          { id: "n3", title: "Concept C", content: "Content C" },
        ];

        const result = buildTutorContext(nodes, "n2", "guided", "graph-123");

        expect(result.mode).toBe("guided");
        expect(result.graphId).toBe("graph-123");
        expect(result.currentNodeId).toBe("n2");
        expect(result.currentNodeTitle).toBe("Concept B");
        expect(result.currentNodeContent).toBe("Content B");
        expect(result.existingNodes).toEqual([
          "Concept A",
          "Concept B",
          "Concept C",
        ]);
      });

      it("未指定 graphId 时仅返回 mode，不填充图谱字段", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Node", content: "content" },
        ];

        const result = buildTutorContext(nodes, "n1", "free");

        expect(result.mode).toBe("free");
        expect(result.graphId).toBeUndefined();
        expect(result.existingNodes).toBeUndefined();
        expect(result.currentNodeId).toBeUndefined();
        expect(result.currentNodeTitle).toBeUndefined();
        expect(result.currentNodeContent).toBeUndefined();
      });

      it("currentNodeId 不在节点列表中时不填充 currentNode 字段", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Exists", content: "yes" },
        ];

        const result = buildTutorContext(
          nodes,
          "non-existent",
          "free",
          "graph-456",
        );

        // graphId 与 existingNodes 仍应填充
        expect(result.graphId).toBe("graph-456");
        expect(result.existingNodes).toEqual(["Exists"]);
        // 但 currentNode 相关字段为 undefined
        expect(result.currentNodeId).toBeUndefined();
        expect(result.currentNodeTitle).toBeUndefined();
        expect(result.currentNodeContent).toBeUndefined();
      });

      it("未指定 mode 时默认为 'free'", () => {
        const nodes: (GraphNode | null)[] = [];
        const result = buildTutorContext(nodes);

        expect(result.mode).toBe("free");
      });

      it("currentNode content 为 null 时 currentNodeContent 为 undefined", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "NullContent", content: null },
        ];

        const result = buildTutorContext(nodes, "n1", "free", "graph-789");

        expect(result.currentNodeId).toBe("n1");
        expect(result.currentNodeTitle).toBe("NullContent");
        // null content 通过 ?? 转为 undefined
        expect(result.currentNodeContent).toBeUndefined();
      });

      it("过滤 null 节点后再构建 existingNodes", () => {
        const nodes: (GraphNode | null)[] = [
          { id: "n1", title: "Valid", content: "v" },
          null,
          { id: "n2", title: "AlsoValid", content: "av" },
        ];

        const result = buildTutorContext(nodes, undefined, "free", "g-1");

        expect(result.existingNodes).toEqual(["Valid", "AlsoValid"]);
      });
    });
  });
});
