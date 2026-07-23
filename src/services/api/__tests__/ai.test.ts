import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock ../client: `request` is the primary spy for the thin-delegation layer.
// `injectAIConfig` is mocked as identity so the serialized request body is
// deterministic and equals JSON.stringify({ ...data, language: <resolved> }).
// The remaining helpers are stubbed so ai.ts side-effects (stream wrapper,
// document upload) run without hitting real network code.
vi.mock('../client', () => ({
  request: vi.fn(),
  injectAIConfig: vi.fn((data: unknown) => data),
  getAIConfig: vi.fn(() => ({ provider: 'p', model: 'm' })),
  getApiUrl: vi.fn(async () => 'http://api.test'),
  handleResponse: vi.fn(),
  getCookie: vi.fn(() => null),
}));

vi.mock('../../shared/streamHandler', () => ({
  createStreamHandler: vi.fn(),
  handleUnauthorized: vi.fn(),
}));

vi.mock('@/store/useStore', () => ({
  useStore: { getState: () => ({ token: null }) },
}));

vi.mock('@/hooks/useAILanguage', () => ({
  getAILanguage: vi.fn(() => 'zh-CN'),
}));

// --- Imports (must be after vi.mock declarations) ---

import { aiApi, aiActionsApi } from '../ai';
import { request, handleResponse } from '../client';
import { createStreamHandler } from '../../shared/streamHandler';
import { getAILanguage } from '@/hooks/useAILanguage';

// --- Helpers ---

/** Default language resolved by getAILanguage() when data.language is omitted. */
const DEFAULT_LANG = 'zh-CN';

/** Shared onChunk callback used by streaming methods. */
const onChunk = vi.fn();

// --- Tests ---

describe('aiActionsApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('list', () => {
    it('应该在无 graphId 时调用 GET /ai-actions', () => {
      aiActionsApi.list();

      expect(request).toHaveBeenCalledWith('/ai-actions');
    });

    it('应该在有 graphId 时拼接查询参数 ?graph_id=', () => {
      aiActionsApi.list('g1');

      expect(request).toHaveBeenCalledWith('/ai-actions?graph_id=g1');
    });
  });

  describe('create', () => {
    it('应该以 POST 方式调用 /ai-actions 并携带 JSON 序列化的 body', () => {
      const data = { name: '动作1', type: 'summarize' };

      aiActionsApi.create(data);

      expect(request).toHaveBeenCalledWith('/ai-actions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('update', () => {
    it('应该以 PUT 方式调用 /ai-actions/${id} 并携带 JSON 序列化的 body', () => {
      const data = { name: '动作2' };

      aiActionsApi.update('a1', data);

      expect(request).toHaveBeenCalledWith('/ai-actions/a1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('delete', () => {
    it('应该以 DELETE 方式调用 /ai-actions/${id}', () => {
      aiActionsApi.delete('a1');

      expect(request).toHaveBeenCalledWith('/ai-actions/a1', {
        method: 'DELETE',
      });
    });
  });

  describe('execute', () => {
    it('应该以 POST 方式调用 /ai-actions/execute 并携带 JSON 序列化的 body', () => {
      const data = { action_id: 'a1', node_id: 'n1' };

      aiActionsApi.execute(data);

      expect(request).toHaveBeenCalledWith('/ai-actions/execute', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在提供 graph_id 时将其包含在 body 中', () => {
      const data = { action_id: 'a1', node_id: 'n1', graph_id: 'g1' };

      aiActionsApi.execute(data);

      expect(request).toHaveBeenCalledWith('/ai-actions/execute', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });
});

describe('aiApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAILanguage).mockReturnValue(DEFAULT_LANG);
  });

  describe('status', () => {
    it('应该调用 GET /ai/status', () => {
      aiApi.status();

      expect(request).toHaveBeenCalledWith('/ai/status');
    });
  });

  describe('generateContent', () => {
    it('应该以 POST 方式调用 /ai/generate-content，未传 language 时使用默认语言', () => {
      const data = { topic: '量子力学' };

      aiApi.generateContent(data);

      expect(request).toHaveBeenCalledWith('/ai/generate-content', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });

    it('应该在传入 language 时使用传入值而非默认语言', () => {
      const data = { topic: '量子力学', language: 'en-US' };

      aiApi.generateContent(data);

      expect(request).toHaveBeenCalledWith('/ai/generate-content', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: 'en-US' }),
      });
    });
  });

  describe('generateContentStream', () => {
    it('应该以流式方式调用 createStreamHandler 请求 /ai/generate-content-stream', async () => {
      const data = { topic: '量子力学' };

      await aiApi.generateContentStream(data, onChunk);

      expect(createStreamHandler).toHaveBeenCalledWith(
        '/ai/generate-content-stream',
        { ...data, language: DEFAULT_LANG },
        onChunk,
      );
    });
  });

  describe('annotateTerms', () => {
    it('应该以 POST 方式调用 /ai/annotate-terms 并携带注入配置后的 body', () => {
      const data = {
        node_id: 'n1',
        node_content: '内容',
        graph_id: 'g1',
      };

      aiApi.annotateTerms(data);

      expect(request).toHaveBeenCalledWith('/ai/annotate-terms', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('generateLearningMaterial', () => {
    it('应该以 POST 方式调用 /ai/learning-material 并携带注入配置后的 body', () => {
      const data = { topic: '机器学习', level: 'intermediate', graph_id: 'g1' };

      aiApi.generateLearningMaterial(data);

      expect(request).toHaveBeenCalledWith('/ai/learning-material', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('expand', () => {
    it('应该以 POST 方式调用 /ai/expand-knowledge 并携带注入配置后的 body', () => {
      const data = {
        node_title: '神经网络',
        node_content: '内容',
        existing_titles: ['CNN'],
        graph_id: 'g1',
      };

      aiApi.expand(data);

      expect(request).toHaveBeenCalledWith('/ai/expand-knowledge', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('getBranchSuggestions', () => {
    it('应该以 POST 方式调用 /ai/branch-suggestions 并携带注入配置后的 body', () => {
      const data = { node_title: '神经网络', context_level: 'L2' };

      aiApi.getBranchSuggestions(data);

      expect(request).toHaveBeenCalledWith('/ai/branch-suggestions', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('generateCards', () => {
    it('应该以 POST 方式调用 /ai/generate-cards 并携带注入配置后的 body', () => {
      const data = { node_title: '神经网络', count: 5, types: ['qa'] };

      aiApi.generateCards(data);

      expect(request).toHaveBeenCalledWith('/ai/generate-cards', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('batchGenerateCards', () => {
    it('应该以 POST 方式调用 /ai/batch-generate-cards 并携带 node_ids 与注入配置后的 config', () => {
      const node_ids = ['n1', 'n2'];
      const config = { count: 5, types: ['qa'] };

      aiApi.batchGenerateCards(node_ids, config);

      expect(request).toHaveBeenCalledWith('/ai/batch-generate-cards', {
        method: 'POST',
        body: JSON.stringify({
          node_ids,
          config: { ...config, language: DEFAULT_LANG },
        }),
      });
    });
  });

  describe('batchExpandGraph', () => {
    it('应该以 POST 方式调用 /ai/batch-expand-graph 并将 node_ids 包装为 body', () => {
      aiApi.batchExpandGraph(['n1', 'n2']);

      expect(request).toHaveBeenCalledWith('/ai/batch-expand-graph', {
        method: 'POST',
        body: JSON.stringify({ node_ids: ['n1', 'n2'] }),
      });
    });
  });

  describe('getTaskStatus', () => {
    it('应该调用 GET /ai/tasks/${id}', () => {
      aiApi.getTaskStatus('t1');

      expect(request).toHaveBeenCalledWith('/ai/tasks/t1');
    });
  });

  describe('textToGraph', () => {
    it('应该以 POST 方式调用 /ai/text-to-graph 并携带注入配置后的 body', () => {
      const data = { text: '一段文本', graph_id: 'g1', action: 'analyze' };

      aiApi.textToGraph(data);

      expect(request).toHaveBeenCalledWith('/ai/text-to-graph', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('documentToGraph', () => {
    it('应该以 POST 方式调用 fetch /ai/document-to-graph 并将响应交由 handleResponse 处理', async () => {
      const mockResponse = { ok: true, status: 200 } as Response;
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(mockResponse);
      vi.mocked(handleResponse).mockResolvedValue({ ok: true });

      const file = new File(['content'], 'doc.pdf', {
        type: 'application/pdf',
      });
      const data = { graph_id: 'g1', file };

      await aiApi.documentToGraph(data);

      expect(fetchSpy).toHaveBeenCalledWith(
        'http://api.test/ai/document-to-graph',
        expect.objectContaining({
          method: 'POST',
          credentials: 'include',
          body: expect.any(FormData),
        }),
      );
      expect(handleResponse).toHaveBeenCalledWith(mockResponse);

      fetchSpy.mockRestore();
    });
  });

  describe('imageToGraph', () => {
    it('应该以 POST 方式调用 /ai/image-to-graph，body 为 FormData', () => {
      const formData = new FormData();
      formData.append('file', 'dummy');

      aiApi.imageToGraph(formData);

      expect(request).toHaveBeenCalledWith('/ai/image-to-graph', {
        method: 'POST',
        body: formData,
      });
    });
  });

  describe('urlToText', () => {
    it('应该以 POST 方式调用 /ai/url-to-text 并将 url 包装为 body', () => {
      aiApi.urlToText('https://example.com');

      expect(request).toHaveBeenCalledWith('/ai/url-to-text', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
      });
    });
  });

  describe('recommendConnections', () => {
    it('应该在未提供 node_content 时以 POST 方式调用 /ai/recommend-connections', () => {
      const data = { graph_id: 'g1', node_title: '节点1' };

      aiApi.recommendConnections(data);

      expect(request).toHaveBeenCalledWith('/ai/recommend-connections', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该在提供 node_content 时将其包含在 body 中', () => {
      const data = { graph_id: 'g1', node_title: '节点1', node_content: '内容' };

      aiApi.recommendConnections(data);

      expect(request).toHaveBeenCalledWith('/ai/recommend-connections', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('chatStream', () => {
    it('应该以流式方式调用 createStreamHandler 请求 /ai/chat 并附带鉴权选项', async () => {
      const data = { message: '你好', graph_id: 'g1' };

      await aiApi.chatStream(data, onChunk);

      expect(createStreamHandler).toHaveBeenCalledWith(
        '/ai/chat',
        { ...data, language: DEFAULT_LANG },
        onChunk,
        expect.objectContaining({
          baseUrl: 'http://api.test',
          token: null,
          csrfToken: null,
        }),
      );
    });
  });

  describe('tutorChatStream', () => {
    it('应该以流式方式调用 createStreamHandler 请求 /ai/tutor-chat', async () => {
      const data = { message: '讲解一下', graph_id: 'g1', mode: 'socratic' };

      await aiApi.tutorChatStream(data, onChunk);

      expect(createStreamHandler).toHaveBeenCalledWith(
        '/ai/tutor-chat',
        { ...data, language: DEFAULT_LANG },
        onChunk,
      );
    });
  });

  describe('extractConcepts', () => {
    it('应该以 POST 方式调用 /ai/extract-concepts 并携带注入配置后的 body', () => {
      const data = { text: '一段文本', existing_nodes: ['概念1'], max_concepts: 5 };

      aiApi.extractConcepts(data);

      expect(request).toHaveBeenCalledWith('/ai/extract-concepts', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('suggestNextTopic', () => {
    it('应该以 POST 方式调用 /ai/suggest-next-topic 并携带注入配置后的 body', () => {
      const data = {
        node_title: '神经网络',
        existing_nodes: ['CNN'],
        user_progress: { mastered_count: 3, due_count: 1 },
      };

      aiApi.suggestNextTopic(data);

      expect(request).toHaveBeenCalledWith('/ai/suggest-next-topic', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });

  describe('generatePodcastScript', () => {
    it('应该在仅传 context 时使用默认语言并调用 /ai/podcast/script', () => {
      aiApi.generatePodcastScript('讲解内容');

      expect(request).toHaveBeenCalledWith('/ai/podcast/script', {
        method: 'POST',
        body: JSON.stringify({ context: '讲解内容', language: DEFAULT_LANG }),
      });
    });

    it('应该在传入自定义 language 与 graph_id 时使用传入值', () => {
      aiApi.generatePodcastScript('讲解内容', 'en-US', 'g1');

      expect(request).toHaveBeenCalledWith('/ai/podcast/script', {
        method: 'POST',
        body: JSON.stringify({
          context: '讲解内容',
          language: 'en-US',
          graph_id: 'g1',
        }),
      });
    });
  });

  describe('analyzeCrossGraphConnections', () => {
    it('应该以 POST 方式调用 /ai/cross-graph-connections 并携带注入配置后的 body', () => {
      const data = {
        graph1_id: 'g1',
        graph1_title: '图谱1',
        graph1_nodes: [{ id: 'n1', title: '节点1' }],
        graph2_id: 'g2',
        graph2_title: '图谱2',
        graph2_nodes: [{ id: 'n2', title: '节点2' }],
      };

      aiApi.analyzeCrossGraphConnections(data);

      expect(request).toHaveBeenCalledWith('/ai/cross-graph-connections', {
        method: 'POST',
        body: JSON.stringify({ ...data, language: DEFAULT_LANG }),
      });
    });
  });
});
