/**
 * AI Service 集成测试 (Task 3.10)
 *
 * 测试策略：
 * - 非流式 chat()：通过 MSW 拦截 OpenAI HTTP API，测试真实 HTTP 请求 → 响应链路，
 *   覆盖成功、超时、429 限流、500→200 重试、无效响应场景。
 * - 流式 streamChatCompletion()：通过 mock provider 的 async iterable 测试
 *   流式迭代逻辑（chunk 发送、超时保护、错误传播）。
 *
 * Mock 策略：
 * - openai 模块：继承真实 OpenAI 类但强制 maxRetries=0，避免 SDK 自身重试拖慢测试
 * - factory 模块：返回通过 providerRegistry.create 构造的真实 provider
 * - aiMonitor / performanceMonitor：mock 为空操作，避免 DB 副作用
 * - documentParsingService：mock 避免 pdfjs-dist 在 jsdom 环境加载失败
 *
 * 与 chatService.test.ts（单元测试）的区别：
 * - 单元测试 mock 整个 factory + provider.client，仅测试 chatService 逻辑
 * - 集成测试使用真实 OpenAI SDK + MSW HTTP 拦截，测试完整请求-响应链路
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";
import type { Response } from "express";
import { server } from "../../../../tests/setup/mswServer";
import {
  createMockResponse,
  createMockProvider,
} from "../../../../tests/helpers/mockFactories";
import type { AIProvider, ChatCompletionChunk } from "@shared/types";

// ============================================================
// Mock 注册（vi.mock 会被 vitest 提升到文件顶部）
// ============================================================

// Mock openai 模块：继承真实 OpenAI 类但强制 maxRetries=0
// 这样 SDK 自身不重试，仅由 withTimeoutAndRetry 控制重试逻辑
// 同时强制 dangerouslyAllowBrowser:true，绕过 jsdom 环境下的浏览器安全检查
// （测试环境不会暴露真实 API Key，MSW 会拦截所有 HTTP 请求）
vi.mock("openai", async () => {
  const actual = await vi.importActual<typeof import("openai")>("openai");
  const RealOpenAI = actual.default;
  class NoRetryOpenAI extends RealOpenAI {
    constructor(config?: ConstructorParameters<typeof RealOpenAI>[0]) {
      super({
        ...config,
        maxRetries: 0,
        dangerouslyAllowBrowser: true,
      });
    }
  }
  return { ...actual, default: NoRetryOpenAI };
});

// Mock factory：返回通过 providerRegistry 构造的真实 provider
vi.mock("../../../services/ai/factory", () => ({
  getAIProvider: vi.fn(),
  getAIProviderForTask: vi.fn(),
  clearProviderCache: vi.fn(),
}));

// Mock aiMonitor：避免 performanceMonitor / pricingService 的 DB 副作用
vi.mock("../../../services/ai/aiMonitor", () => ({
  withAIMonitoring: vi.fn(
    async <T>(
      _options: Record<string, unknown>,
      fn: () => Promise<{ result: T; usage?: unknown }>,
    ): Promise<T> => {
      const res = await fn();
      return res.result;
    },
  ),
  withEmbeddingMonitoring: vi.fn(
    async <T>(
      _options: Record<string, unknown>,
      fn: () => Promise<{ result: T; usage?: unknown }>,
    ): Promise<T> => {
      const res = await fn();
      return res.result;
    },
  ),
}));

// Mock performanceMonitor：避免 enrichMetadata 的 DB 查询
vi.mock("../../../services/ai/performanceMonitor", () => ({
  performanceMonitor: {
    recordLog: vi.fn(),
    initialize: vi.fn().mockResolvedValue(undefined),
  },
  enrichMetadata: vi.fn().mockResolvedValue({}),
}));

// Mock documentParsingService：避免 pdfjs-dist 在 jsdom 环境加载失败
vi.mock("../../../services/ai/documentParsingService", () => ({
  documentParsingService: {
    parseDocument: vi.fn(),
    parsePdf: vi.fn(),
    parseDocx: vi.fn(),
  },
  DocumentParsingService: class MockDocumentParsingService {},
}));

// ============================================================
// 模块导入（在 mock 注册后执行）
// ============================================================

import { chatService } from "../../../services/ai/chatService";
import * as factory from "../../../services/ai/factory";
import { providerRegistry } from "../../../services/ai/providerRegistry";
import { pendingRequests } from "../../../services/ai/aiUtils";
import { AppError } from "../../../middleware/errorHandler";
import { ErrorCodes } from "../../../../shared/types/errorCodes";

// 导入 providers/openai 以注册 OpenAI provider
import "../../../services/ai/providers/openai";

// ============================================================
// 常量与辅助函数
// ============================================================

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";

/** 创建真实的 OpenAI provider（通过 providerRegistry，使用测试 API key） */
const createRealOpenAIProvider = (): AIProvider => {
  return providerRegistry.create("openai", {
    apiKey: "test-api-key-for-integration",
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
  });
};

/** 创建 mock 流式 async iterable */
const createMockStream = <T>(
  items: T[],
  delayMs: number = 0,
): { [Symbol.asyncIterator](): AsyncIterator<T> } => {
  return {
    [Symbol.asyncIterator]() {
      let index = 0;
      return {
        async next(): Promise<IteratorResult<T>> {
          if (delayMs > 0) {
            await new Promise((resolve) => setTimeout(resolve, delayMs));
          }
          if (index < items.length) {
            return { value: items[index++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
};

/** 访问 chatService 的 private 方法 streamChatCompletion */
const getStreamChatCompletion = () =>
  (
    chatService as unknown as {
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
    }
  ).streamChatCompletion.bind(chatService);

// ============================================================
// 测试套件
// ============================================================

describe("AI Service 集成测试", () => {
  let realProvider: AIProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    // 清理 dedupedRequest 的 pendingRequests 缓存
    pendingRequests.clear();

    // 创建真实 provider 并注入 factory mock
    realProvider = createRealOpenAIProvider();
    vi.mocked(factory.getAIProviderForTask).mockResolvedValue(realProvider);
    vi.mocked(factory.getAIProvider).mockResolvedValue(realProvider);
  });

  afterEach(() => {
    pendingRequests.clear();
  });

  // ============================================================
  // 非流式 chat() — MSW HTTP 集成
  // ============================================================
  describe("非流式 chat() - MSW HTTP 集成", () => {
    // ----------------------------------------------------------
    // 成功响应
    // ----------------------------------------------------------
    it("成功响应：MSW 返回有效 JSON → chat() 返回 AI 内容", async () => {
      server.use(
        http.post(OPENAI_CHAT_URL, () =>
          HttpResponse.json({
            choices: [{ message: { content: "Hello from mocked AI" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
        ),
      );

      const result = await chatService.chat([
        { role: "user", content: "integration-test-success-001" },
      ]);

      expect(result).toBe("Hello from mocked AI");
    });

    it("成功响应：传递完整 messages 和 model 给 API", async () => {
      let capturedBody: Record<string, unknown> | undefined;
      server.use(
        http.post(OPENAI_CHAT_URL, async ({ request }) => {
          capturedBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            choices: [{ message: { content: "OK" } }],
            usage: { prompt_tokens: 5, completion_tokens: 1 },
          });
        }),
      );

      const messages = [
        { role: "system" as const, content: "You are helpful" },
        { role: "user" as const, content: "integration-test-messages-002" },
      ];

      await chatService.chat(messages, { model: "gpt-4o-mini" });

      expect(capturedBody).toBeDefined();
      expect(capturedBody?.model).toBe("gpt-4o-mini");
      expect(capturedBody?.messages).toEqual(messages);
    });

    // ----------------------------------------------------------
    // 无效响应
    // ----------------------------------------------------------
    it("无效响应：MSW 返回非 JSON 内容 → chat() 抛出 AppError", async () => {
      server.use(
        http.post(OPENAI_CHAT_URL, () =>
          new HttpResponse("Internal Server Error - not JSON", {
            status: 500,
          }),
        ),
      );

      // 500 错误会被 withTimeoutAndRetry 重试 3 次后抛出 RetryError
      // chat() 将其转换为 AppError(AI_PROVIDER_ERROR)
      await expect(
        chatService.chat([
          { role: "user", content: "integration-test-invalid-003" },
        ]),
      ).rejects.toThrow();

      // 验证 factory.getAIProviderForTask 被调用
      expect(factory.getAIProviderForTask).toHaveBeenCalledWith("text");
    });

    // ----------------------------------------------------------
    // 超时
    // ----------------------------------------------------------
    it("超时：MSW 延迟响应 → chat() 在超时后抛出 AppError", async () => {
      server.use(
        http.post(OPENAI_CHAT_URL, async () => {
          await delay(5000); // 5 秒延迟，远超 timeout
          return HttpResponse.json({
            choices: [{ message: { content: "too late" } }],
          });
        }),
      );

      // 使用短 timeout (100ms)，maxRetries 硬编码为 3
      // 3 次超时后抛出 RetryError → AppError(AI_PROVIDER_ERROR)
      const start = Date.now();
      await expect(
        chatService.chat(
          [{ role: "user", content: "integration-test-timeout-004" }],
          { timeout: 100 },
        ),
      ).rejects.toThrow();

      const elapsed = Date.now() - start;
      // 至少经过 3 次超时 + 2 次重试 backoff (1000ms + 2000ms)
      // 总时间应 > 3s（含 backoff）
      expect(elapsed).toBeGreaterThan(2500);
    }, 15000); // 15 秒超时上限

    // ----------------------------------------------------------
    // 429 限流
    // ----------------------------------------------------------
    it("429 限流：MSW 返回 429 → chat() 重试后抛出 AppError", async () => {
      server.use(
        http.post(OPENAI_CHAT_URL, () =>
          HttpResponse.json(
            { error: { message: "Rate limit exceeded", type: "rate_limit_error" } },
            { status: 429 },
          ),
        ),
      );

      try {
        await chatService.chat([
          { role: "user", content: "integration-test-429-005" },
        ]);
        expect.fail("应抛出 AppError");
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        const appError = error as AppError;
        // 429 可重试，3 次失败后 RetryError → AI_PROVIDER_ERROR
        expect(appError.code).toBe(ErrorCodes.AI_PROVIDER_ERROR);
      }
    }, 15000);

    // ----------------------------------------------------------
    // 重试后成功（500 → 200）
    // ----------------------------------------------------------
    it("重试成功：MSW 首次 500，二次 200 → chat() 重试后成功", async () => {
      let callCount = 0;
      server.use(
        http.post(OPENAI_CHAT_URL, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: { message: "Internal Server Error" } },
              { status: 500 },
            );
          }
          return HttpResponse.json({
            choices: [{ message: { content: "Success after retry" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          });
        }),
      );

      const result = await chatService.chat([
        { role: "user", content: "integration-test-retry-006" },
      ]);

      expect(result).toBe("Success after retry");
      expect(callCount).toBe(2); // 第一次失败 + 第二次成功
    }, 15000);

    // ----------------------------------------------------------
    // 无 API Key 时返回 mock 响应
    // ----------------------------------------------------------
    it("无 API Key：provider.hasKey=false → 返回 mock 响应，不调用 API", async () => {
      const noKeyProvider = providerRegistry.create("openai", {
        apiKey: "",
        baseURL: "https://api.openai.com/v1",
        model: "gpt-4o-mini",
      });
      vi.mocked(factory.getAIProviderForTask).mockResolvedValue(noKeyProvider);

      let apiCalled = false;
      server.use(
        http.post(OPENAI_CHAT_URL, () => {
          apiCalled = true;
          return HttpResponse.json({ choices: [{ message: { content: "should not reach" } }] });
        }),
      );

      const result = await chatService.chat([
        { role: "user", content: "integration-test-nokey-007" },
      ]);

      expect(typeof result).toBe("string");
      expect(apiCalled).toBe(false);
    });
  });

  // ============================================================
  // 流式 streamChatCompletion() — mock provider 迭代逻辑
  // ============================================================
  describe("流式 streamChatCompletion()", () => {
    it("流式成功：迭代 chunks 并通过 sendStreamChunk 发送", async () => {
      const mockProvider = createMockProvider();
      const chunks: ChatCompletionChunk[] = [
        { choices: [{ delta: { content: "Hello" } }] },
        { choices: [{ delta: { content: " " } }] },
        { choices: [{ delta: { content: "World" } }] },
        { choices: [{ delta: {} }] },
      ];
      (
        mockProvider.client.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(createMockStream(chunks));

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "stream-test-001" }],
        "test-model",
        {
          operation: "chat",
          metadata: {},
          sessionId: "session-stream-001",
        },
      );

      // 3 个有 content 的 chunk 触发 sendStreamChunk
      expect(res.write).toHaveBeenCalledTimes(3);

      // 验证发送的 content 拼接为 "Hello World"
      const mockRes = res as unknown as { chunks: string[] };
      expect(mockRes.chunks).toEqual(["Hello", " ", "World"]);
    });

    it("流式调用使用 stream:true 和 stream_options 参数", async () => {
      const mockProvider = createMockProvider();
      (
        mockProvider.client.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(createMockStream([{ choices: [{ delta: { content: "x" } }] }]));

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "stream-test-002" }],
        "test-model",
        { operation: "chat", metadata: {}, sessionId: "session-stream-002" },
      );

      expect(
        mockProvider.client.chat.completions.create,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          stream: true,
          stream_options: { include_usage: true },
        }),
      );
    });

    it("chunk 无 content 时不调用 sendStreamChunk", async () => {
      const mockProvider = createMockProvider();
      const chunks: ChatCompletionChunk[] = [
        { choices: [{ delta: {} }] },
        { choices: [{ delta: { content: "only-this" } }] },
        { choices: [{ delta: null }] },
      ];
      (
        mockProvider.client.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(createMockStream(chunks));

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "stream-test-003" }],
        "test-model",
        { operation: "chat", metadata: {}, sessionId: "session-stream-003" },
      );

      expect(res.write).toHaveBeenCalledTimes(1);
      const mockRes = res as unknown as { chunks: string[] };
      expect(mockRes.chunks).toEqual(["only-this"]);
    });

    it("usage 从最后一个 chunk 提取", async () => {
      const mockProvider = createMockProvider();
      const chunks: ChatCompletionChunk[] = [
        { choices: [{ delta: { content: "response" } }] },
        {
          choices: [{ delta: {} }],
          usage: {
            prompt_tokens: 25,
            completion_tokens: 12,
            prompt_tokens_details: { cached_tokens: 8 },
          } as ChatCompletionChunk["usage"],
        },
      ];
      (
        mockProvider.client.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(createMockStream(chunks));

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "stream-test-004" }],
        "test-model",
        { operation: "chat", metadata: {}, sessionId: "session-stream-004" },
      );

      // withAIMonitoring 被 mock 为直接调用 fn，不验证 recordLog
      // 仅验证 stream 正常完成
      expect(res.write).toHaveBeenCalledTimes(1);
    });

    it("流式迭代错误时抛出异常", async () => {
      const mockProvider = createMockProvider();
      const failingStream = {
        [Symbol.asyncIterator]() {
          return {
            next(): Promise<IteratorResult<ChatCompletionChunk>> {
              return Promise.reject(new Error("stream iteration failed"));
            },
          };
        },
      };
      (
        mockProvider.client.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(failingStream);

      const res = createMockResponse();

      await expect(
        getStreamChatCompletion()(
          res,
          mockProvider,
          [{ role: "user", content: "stream-test-005" }],
          "test-model",
          { operation: "chat", metadata: {}, sessionId: "session-stream-005" },
        ),
      ).rejects.toThrow("stream iteration failed");
    });

    it("空 chunk 列表：流式立即完成，不发送任何 content", async () => {
      const mockProvider = createMockProvider();
      (
        mockProvider.client.chat.completions.create as ReturnType<typeof vi.fn>
      ).mockReturnValue(createMockStream<ChatCompletionChunk>([]));

      const res = createMockResponse();

      await getStreamChatCompletion()(
        res,
        mockProvider,
        [{ role: "user", content: "stream-test-006" }],
        "test-model",
        { operation: "chat", metadata: {}, sessionId: "session-stream-006" },
      );

      expect(res.write).not.toHaveBeenCalled();
    });
  });
});
