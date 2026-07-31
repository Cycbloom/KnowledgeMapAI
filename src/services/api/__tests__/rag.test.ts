import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// --- Hoisted mock state ---
// 使用 vi.hoisted 确保 mockState 在 vi.mock 工厂执行前就已创建，
// 并且每次 getState() 返回同一个稳定对象（便于断言 setUser 等字段）。
const { mockState } = vi.hoisted(() => ({
  mockState: {
    user: null as null,
    token: 'token-123' as string | null,
    refreshToken: null as string | null,
    setUser: vi.fn(),
    clearAuth: vi.fn(),
  },
}));

// --- Mocks ---

// Mock ../client: request (spy for chat/search/analyzeGaps), getAIConfig 与 getApiUrl
// 被 chat 与 chatStream 用于注入 provider/model 与拼接流式 URL
vi.mock('../client', () => ({
  request: vi.fn(),
  getAIConfig: vi.fn(() => ({ provider: 'p', model: 'm' })),
  getApiUrl: vi.fn(async () => 'http://api.test'),
}));

// Mock useStore(chatStream 读取 token 并在 401 时调用 setUser)
// 使用相对路径确保 vitest 正确拦截模块（@/ 别名在 vi.mock 中可能不被解析）
vi.mock('../../../store/useStore', () => ({
  useStore: {
    getState: () => mockState,
  },
}));

// Mock getAILanguage(chat/chatStream 在 data.language 缺省时注入默认语言)
vi.mock('../../../hooks/ai/useAILanguage', () => ({
  getAILanguage: vi.fn(() => 'zh-CN'),
}));

// Mock logger(stream parse error 路径调用 logger.error)
vi.mock('../../../utils/logger', () => ({
  logger: { error: vi.fn() },
}));

// --- Imports (must be after vi.mock declarations) ---

import { ragApi } from '../rag';
import { request, getAIConfig, getApiUrl } from '../client';
import { getAILanguage } from '../../../hooks/ai/useAILanguage';
import { logger } from '../../../utils/logger';

// --- Helpers ---

const DEFAULT_LANG = 'zh-CN';

/** 将字符串编码为 Uint8Array。 */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/** 构造成功的 mock Response，body 为可读取的 ReadableStream。 */
function createMockStreamResponse(chunks: Uint8Array[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(chunk);
      }
      controller.close();
    },
  });
  return new Response(stream, { status: 200 });
}

/** 构造失败的 mock Response，body 为文本。 */
function createMockErrorResponse(text: string, status: number): Response {
  return new Response(text, { status });
}

// --- Tests ---

describe('ragApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 mockState 到默认值
    mockState.token = 'token-123';
    // 重新设置 config 与 language 的默认返回值
    vi.mocked(getAILanguage).mockReturnValue(DEFAULT_LANG);
    vi.mocked(getAIConfig).mockReturnValue({ provider: 'p', model: 'm' });
    vi.mocked(getApiUrl).mockResolvedValue('http://api.test');
  });

  describe('chat', () => {
    it('应该以 POST 方式调用 /rag/chat 并注入默认 language/provider/model', async () => {
      const data = { message: '你好' };
      await ragApi.chat(data);

      expect(request).toHaveBeenCalledWith('/rag/chat', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          language: DEFAULT_LANG,
          provider: 'p',
          model: 'm',
        }),
      });
    });

    it('应该在传入 language 时使用传入值而非默认语言', async () => {
      const data = { message: '你好', language: 'en-US' };
      await ragApi.chat(data);

      expect(request).toHaveBeenCalledWith('/rag/chat', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          language: 'en-US',
          provider: 'p',
          model: 'm',
        }),
      });
    });

    it('应该在传入 provider/model 时使用传入值而非 config', async () => {
      const data = {
        message: '你好',
        provider: 'custom-p',
        model: 'custom-m',
      };
      await ragApi.chat(data);

      expect(request).toHaveBeenCalledWith('/rag/chat', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          language: DEFAULT_LANG,
          provider: 'custom-p',
          model: 'custom-m',
        }),
      });
    });

    it('应该在 config 无 provider/model 时不注入这两个字段', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });
      const data = { message: '你好' };
      await ragApi.chat(data);

      expect(request).toHaveBeenCalledWith('/rag/chat', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          language: DEFAULT_LANG,
        }),
      });
    });
  });

  describe('search', () => {
    it('应该以 POST 方式调用 /rag/search 并携带 JSON body', async () => {
      const data = { query: '量子力学' };
      await ragApi.search(data);

      expect(request).toHaveBeenCalledWith('/rag/search', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在传入完整可选参数时全部包含在 body 中', async () => {
      const data = {
        query: '量子力学',
        graph_id: 'g1',
        match_threshold: 0.8,
        match_count: 10,
        use_graph_context: true,
        graph_hops: 2,
        search_mode: 'hybrid' as const,
      };
      await ragApi.search(data);

      expect(request).toHaveBeenCalledWith('/rag/search', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('analyzeGaps', () => {
    it('应该以 POST 方式调用 /rag/analyze-gaps 并将 graphId 包装为 graph_id', async () => {
      await ragApi.analyzeGaps('g1');

      expect(request).toHaveBeenCalledWith('/rag/analyze-gaps', {
        method: 'POST',
        body: JSON.stringify({ graph_id: 'g1' }),
      });
    });
  });

  describe('chatStream', () => {
    let fetchSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      fetchSpy = vi.spyOn(globalThis, 'fetch');
    });

    afterEach(() => {
      fetchSpy.mockRestore();
    });

    it('应该以 POST 方式调用 fetch ${apiUrl}/rag/chat/stream 并携带鉴权头与注入配置后的 body', async () => {
      fetchSpy.mockResolvedValue(createMockStreamResponse([]));

      const data = { message: '你好' };
      await ragApi.chatStream(data, vi.fn());

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://api.test/rag/chat/stream',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer token-123',
          },
          body: JSON.stringify({
            ...data,
            language: DEFAULT_LANG,
            provider: 'p',
            model: 'm',
          }),
        }),
      );
    });

    it('应该在 token 为空时不附加 Authorization 头', async () => {
      mockState.token = null;
      fetchSpy.mockResolvedValue(createMockStreamResponse([]));

      const data = { message: '你好' };
      await ragApi.chatStream(data, vi.fn());

      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs?.[1]?.headers).toEqual({
        'Content-Type': 'application/json',
      });
    });

    it('应该在 response 不 ok 时抛出包含 errorText 的 AppError', async () => {
      fetchSpy.mockResolvedValue(createMockErrorResponse('Server error', 500));

      await expect(
        ragApi.chatStream({ message: '你好' }, vi.fn()),
      ).rejects.toThrow('Server error');
    });

    it('应该在 errorText 为空时抛出默认错误消息', async () => {
      fetchSpy.mockResolvedValue(createMockErrorResponse('', 500));

      await expect(
        ragApi.chatStream({ message: '你好' }, vi.fn()),
      ).rejects.toThrow('RAG Chat Stream failed');
    });

    it('应该在 response.status 为 401 时调用 setUser(null, null) 并抛出', async () => {
      fetchSpy.mockResolvedValue(createMockErrorResponse('Unauthorized', 401));

      await expect(
        ragApi.chatStream({ message: '你好' }, vi.fn()),
      ).rejects.toThrow('Unauthorized');

      expect(mockState.setUser).toHaveBeenCalledWith(null, null);
    });

    it('应该在解析到 content 时调用 onChunk', async () => {
      const chunks = [
        encode(`data: ${JSON.stringify({ content: 'hello' })}\n\n`),
      ];
      fetchSpy.mockResolvedValue(createMockStreamResponse(chunks));

      const onChunk = vi.fn();
      await ragApi.chatStream({ message: '你好' }, onChunk);

      expect(onChunk).toHaveBeenCalledWith('hello');
    });

    it('应该在解析到 sources 时调用 onSources', async () => {
      const sources = [
        { id: 's1', title: 't1', content: 'c1', similarity: 0.9 },
      ];
      const chunks = [
        encode(`data: ${JSON.stringify({ sources })}\n\n`),
      ];
      fetchSpy.mockResolvedValue(createMockStreamResponse(chunks));

      const onSources = vi.fn();
      await ragApi.chatStream({ message: '你好' }, vi.fn(), onSources);

      expect(onSources).toHaveBeenCalledWith(sources);
    });

    it('应该在收到 [DONE] 时停止读取且不调用 onChunk', async () => {
      const chunks = [encode('data: [DONE]\n\n')];
      fetchSpy.mockResolvedValue(createMockStreamResponse(chunks));

      const onChunk = vi.fn();
      await ragApi.chatStream({ message: '你好' }, onChunk);

      expect(onChunk).not.toHaveBeenCalled();
    });

    it('应该在传入 signal 时附加到 fetch options', async () => {
      fetchSpy.mockResolvedValue(createMockStreamResponse([]));
      const controller = new AbortController();
      const signal = controller.signal;

      await ragApi.chatStream(
        { message: '你好' },
        vi.fn(),
        undefined,
        signal,
      );

      const callArgs = fetchSpy.mock.calls[0];
      expect(callArgs?.[1]?.signal).toBe(signal);
    });

    it('应该在解析到 error 字段且 signal 未中止时记录日志且不抛出', async () => {
      const chunks = [
        encode(
          `data: ${JSON.stringify({ error: 'something failed' })}\n\n`,
        ),
      ];
      fetchSpy.mockResolvedValue(createMockStreamResponse(chunks));

      await ragApi.chatStream({ message: '你好' }, vi.fn());

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
