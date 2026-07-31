import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request 与 getAIConfig from ./client（autoGraph.ts 同时使用两者）
vi.mock('../client', () => ({
  request: vi.fn(),
  getAIConfig: vi.fn(),
}));

// Mock getAILanguage from @/hooks/ai/useAILanguage
vi.mock('@/hooks/ai/useAILanguage', () => ({
  getAILanguage: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { autoGraphApi } from '../autoGraph';
import { request, getAIConfig } from '../client';
import { getAILanguage } from '@/hooks/ai/useAILanguage';

// --- Tests ---

describe('autoGraphApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
    vi.mocked(getAIConfig).mockClear();
    vi.mocked(getAILanguage).mockClear();
    // 默认 config 与 language，避免方法内部访问 undefined 报错
    vi.mocked(getAIConfig).mockReturnValue({
      provider: 'openai',
      model: 'gpt-4',
    });
    vi.mocked(getAILanguage).mockReturnValue('zh-CN');
  });

  describe('init', () => {
    it('应该调用 init 以 POST 请求 /auto-graph/init，默认 style=academic 并注入 config 与 language', async () => {
      await autoGraphApi.init({ topic: '量子力学' });
      expect(request).toHaveBeenCalledWith('/auto-graph/init', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          topic: '量子力学',
          language: 'zh-CN',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 data 中已有 provider/model 时不被 config 覆盖', async () => {
      await autoGraphApi.init({
        topic: '量子力学',
        provider: 'anthropic',
        model: 'claude-3',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/init', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          topic: '量子力学',
          provider: 'anthropic',
          model: 'claude-3',
          language: 'zh-CN',
        }),
      });
    });

    it('应该在 data 中已有 language 时不调用 getAILanguage()', async () => {
      await autoGraphApi.init({ topic: '量子力学', language: 'en-US' });
      expect(getAILanguage).not.toHaveBeenCalled();
      expect(request).toHaveBeenCalledWith('/auto-graph/init', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          topic: '量子力学',
          language: 'en-US',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 config 无 provider/model 时不注入', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });
      await autoGraphApi.init({ topic: '量子力学' });
      expect(request).toHaveBeenCalledWith('/auto-graph/init', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          topic: '量子力学',
          language: 'zh-CN',
        }),
      });
    });

    it('应该允许 data.style 覆盖默认 academic', async () => {
      await autoGraphApi.init({ topic: '量子力学', style: 'practical' });
      expect(request).toHaveBeenCalledWith('/auto-graph/init', {
        method: 'POST',
        body: JSON.stringify({
          style: 'practical',
          topic: '量子力学',
          language: 'zh-CN',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });
  });

  describe('expand', () => {
    it('应该调用 expand 以 POST 请求 /auto-graph/expand，默认 style=academic 并注入 config 与 language', async () => {
      await autoGraphApi.expand({
        node_id: 'n-1',
        node_title: '微积分',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/expand', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          node_id: 'n-1',
          node_title: '微积分',
          language: 'zh-CN',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 data 中已有 provider/model 时不被 config 覆盖', async () => {
      await autoGraphApi.expand({
        node_id: 'n-1',
        node_title: '微积分',
        provider: 'anthropic',
        model: 'claude-3',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/expand', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          node_id: 'n-1',
          node_title: '微积分',
          provider: 'anthropic',
          model: 'claude-3',
          language: 'zh-CN',
        }),
      });
    });

    it('应该在 data 中已有 language 时不调用 getAILanguage()', async () => {
      await autoGraphApi.expand({
        node_id: 'n-1',
        node_title: '微积分',
        language: 'en-US',
      });
      expect(getAILanguage).not.toHaveBeenCalled();
      expect(request).toHaveBeenCalledWith('/auto-graph/expand', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          node_id: 'n-1',
          node_title: '微积分',
          language: 'en-US',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });
  });

  describe('saveNodes', () => {
    it('应该调用 saveNodes 以 POST 请求 /auto-graph/save-nodes 并原样传递 data', async () => {
      const data = {
        graph_id: 'g-1',
        nodes: [
          { title: '节点1', content: '内容1' },
          { title: '节点2' },
        ],
      };
      await autoGraphApi.saveNodes(data);
      expect(request).toHaveBeenCalledWith('/auto-graph/save-nodes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('optimizePrompt', () => {
    it('应该调用 optimizePrompt 以 POST 请求 /auto-graph/optimize-prompt 并原样传递 data', async () => {
      const data = { topic: '量子力学', currentPrompt: '旧 prompt' };
      await autoGraphApi.optimizePrompt(data);
      expect(request).toHaveBeenCalledWith('/auto-graph/optimize-prompt', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该支持仅传 topic（无 currentPrompt）', async () => {
      const data = { topic: '量子力学' };
      await autoGraphApi.optimizePrompt(data);
      expect(request).toHaveBeenCalledWith('/auto-graph/optimize-prompt', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('generateEmbeddings - 可选 limit 参数', () => {
    it('应该在不传 limit 时请求 /auto-graph/generate-embeddings，body 为 { limit: undefined }', async () => {
      await autoGraphApi.generateEmbeddings();
      expect(request).toHaveBeenCalledWith('/auto-graph/generate-embeddings', {
        method: 'POST',
        body: JSON.stringify({ limit: undefined }),
      });
    });

    it('应该在传 limit 时附加 limit 值', async () => {
      await autoGraphApi.generateEmbeddings(100);
      expect(request).toHaveBeenCalledWith('/auto-graph/generate-embeddings', {
        method: 'POST',
        body: JSON.stringify({ limit: 100 }),
      });
    });
  });

  describe('getEmbeddingStatus', () => {
    it('应该调用 getEmbeddingStatus 以 GET 请求 /auto-graph/embedding-status', async () => {
      await autoGraphApi.getEmbeddingStatus();
      expect(request).toHaveBeenCalledWith('/auto-graph/embedding-status', {
        method: 'GET',
      });
    });
  });

  describe('generateTemplates', () => {
    it('应该调用 generateTemplates 以 POST 请求 /auto-graph/generate-templates，注入 config', async () => {
      await autoGraphApi.generateTemplates({ topic: '机器学习' });
      expect(request).toHaveBeenCalledWith('/auto-graph/generate-templates', {
        method: 'POST',
        body: JSON.stringify({
          topic: '机器学习',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 data 中已有 provider/model 时不被 config 覆盖', async () => {
      await autoGraphApi.generateTemplates({
        topic: '机器学习',
        provider: 'anthropic',
        model: 'claude-3',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/generate-templates', {
        method: 'POST',
        body: JSON.stringify({
          topic: '机器学习',
          provider: 'anthropic',
          model: 'claude-3',
        }),
      });
    });

    it('应该在 config 无 provider/model 时不注入', async () => {
      vi.mocked(getAIConfig).mockReturnValue({
        provider: undefined,
        model: undefined,
      });
      await autoGraphApi.generateTemplates({ topic: '机器学习' });
      expect(request).toHaveBeenCalledWith('/auto-graph/generate-templates', {
        method: 'POST',
        body: JSON.stringify({ topic: '机器学习' }),
      });
    });

    it('应该完整传递 GenerateTemplatesData 字段', async () => {
      const data = {
        topic: '机器学习',
        context: '深度学习基础',
        maxNodes: 20,
        graph_id: 'g-1',
      };
      await autoGraphApi.generateTemplates(data);
      expect(request).toHaveBeenCalledWith('/auto-graph/generate-templates', {
        method: 'POST',
        body: JSON.stringify({
          ...data,
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });
  });

  describe('applyTemplate', () => {
    it('应该调用 applyTemplate 以 POST 请求 /auto-graph/apply-template，默认 style=academic 并注入 config', async () => {
      await autoGraphApi.applyTemplate({
        topic: '量子力学',
        graph_id: 'g-1',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/apply-template', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          topic: '量子力学',
          graph_id: 'g-1',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });

    it('应该在 data 中已有 provider/model 时不被 config 覆盖', async () => {
      await autoGraphApi.applyTemplate({
        topic: '量子力学',
        graph_id: 'g-1',
        provider: 'anthropic',
        model: 'claude-3',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/apply-template', {
        method: 'POST',
        body: JSON.stringify({
          style: 'academic',
          topic: '量子力学',
          graph_id: 'g-1',
          provider: 'anthropic',
          model: 'claude-3',
        }),
      });
    });

    it('应该允许 data.style 覆盖默认 academic', async () => {
      await autoGraphApi.applyTemplate({
        topic: '量子力学',
        graph_id: 'g-1',
        style: 'practical',
      });
      expect(request).toHaveBeenCalledWith('/auto-graph/apply-template', {
        method: 'POST',
        body: JSON.stringify({
          style: 'practical',
          topic: '量子力学',
          graph_id: 'g-1',
          provider: 'openai',
          model: 'gpt-4',
        }),
      });
    });
  });
});
