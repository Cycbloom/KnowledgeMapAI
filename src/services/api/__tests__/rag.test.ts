import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock ../client: request (chat/search/analyzeGaps)，getAIConfig 用于注入 provider/model。
// 流式基址/鉴权/CSRF/移动端头统一由 shared/streamHandler 内部处理，此处不涉及。
vi.mock('../client', () => ({
  request: vi.fn(),
  getAIConfig: vi.fn(() => ({ provider: 'p', model: 'm' })),
}));

// Mock 统一流式出口：仅断言服务层到出口的接线（SSE 解析行为由 streamHandler 自身测试覆盖）
vi.mock('../../shared/streamHandler', () => ({
  createStreamHandler: vi.fn(),
}));

// Mock getAILanguage(chat/chatStream 在 data.language 缺省时注入默认语言)
vi.mock('../../../hooks/ai/useAILanguage', () => ({
  getAILanguage: vi.fn(() => 'zh-CN'),
}));

// --- Imports (must be after vi.mock declarations) ---

import { ragApi } from '../rag';
import { request, getAIConfig } from '../client';
import { createStreamHandler } from '../../shared/streamHandler';
import { getAILanguage } from '../../../hooks/ai/useAILanguage';

// --- Helpers ---

const DEFAULT_LANG = 'zh-CN';

// --- Tests ---

describe('ragApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAILanguage).mockReturnValue(DEFAULT_LANG);
    vi.mocked(getAIConfig).mockReturnValue({ provider: 'p', model: 'm' });
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
    it('应该经统一流式出口请求 /rag/chat/stream 并注入配置后的 payload', async () => {
      const data = { message: '你好' };
      const onChunk = vi.fn();

      await ragApi.chatStream(data, onChunk);

      expect(createStreamHandler).toHaveBeenCalledTimes(1);
      const [url, payload] = vi.mocked(createStreamHandler).mock.calls[0];
      expect(url).toBe('/rag/chat/stream');
      expect(payload).toEqual({
        ...data,
        language: DEFAULT_LANG,
        provider: 'p',
        model: 'm',
      });
      expect(vi.mocked(createStreamHandler).mock.calls[0][2]).toBe(onChunk);
    });

    it('应该把 onSources 包装为 onEvent 的 sources 转发', async () => {
      const onSources = vi.fn();
      await ragApi.chatStream({ message: '你好' }, vi.fn(), onSources);

      const options = vi.mocked(createStreamHandler).mock.calls[0][3];
      const sources = [
        { id: 's1', title: 't1', content: 'c1', similarity: 0.9 },
      ];
      options?.onEvent?.({ sources });

      expect(onSources).toHaveBeenCalledWith(sources);
    });

    it('应该把 AbortSignal 透传给统一流式出口', async () => {
      const controller = new AbortController();

      await ragApi.chatStream(
        { message: '你好' },
        vi.fn(),
        undefined,
        controller.signal,
      );

      const options = vi.mocked(createStreamHandler).mock.calls[0][3];
      expect(options?.signal).toBe(controller.signal);
    });
  });
});
