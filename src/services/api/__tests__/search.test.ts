import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { searchApi, type SearchResult } from '../search';
import { request } from '../client';

// --- Helpers ---

const mockSearchResult: SearchResult = {
  graphs: [
    {
      id: 'g1',
      title: '图谱1',
      description: '描述1',
      updated_at: '2024-01-01',
      nodes_count: 5,
      similarity: 0.9,
    },
  ],
  nodes: [
    {
      id: 'n1',
      graph_id: 'g1',
      title: '节点1',
      content: '内容1',
      similarity: 0.85,
    },
  ],
  notes: [
    {
      id: 'note1',
      title: '笔记1',
      summary: '摘要1',
      type: 'note',
      updated_at: '2024-01-01',
      tags: ['tag1'],
      similarity: 0.8,
    },
  ],
  answer: '这是AI回答',
};

// --- Tests ---

describe('searchApi', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('search', () => {
    it('应该发送 GET 请求到 /search?q= 并编码查询参数', () => {
      searchApi.search('test');

      expect(request).toHaveBeenCalledWith('/search?q=test');
    });

    it('应该返回搜索结果', async () => {
      vi.mocked(request).mockResolvedValue(mockSearchResult);

      const result = await searchApi.search('test');

      expect(result).toEqual(mockSearchResult);
      expect(result.graphs).toHaveLength(1);
      expect(result.nodes).toHaveLength(1);
      expect(result.notes).toHaveLength(1);
      expect(result.answer).toBe('这是AI回答');
    });

    it('应该对特殊字符进行 URL 编码', () => {
      searchApi.search('hello world');

      expect(request).toHaveBeenCalledWith('/search?q=hello%20world');
    });

    it('应该对中文查询参数进行 URL 编码', () => {
      searchApi.search('机器学习');

      expect(request).toHaveBeenCalledWith('/search?q=%E6%9C%BA%E5%99%A8%E5%AD%A6%E4%B9%A0');
    });

    it('请求失败时应该抛出错误', async () => {
      const error = new Error('Network error');
      vi.mocked(request).mockRejectedValue(error);

      await expect(searchApi.search('test')).rejects.toThrow('Network error');
    });
  });

  describe('semanticSearch', () => {
    it('应该发送 GET 请求到 /search?q=&type=semantic', () => {
      searchApi.semanticSearch('test');

      expect(request).toHaveBeenCalledWith('/search?q=test&type=semantic');
    });

    it('应该对特殊字符进行 URL 编码', () => {
      searchApi.semanticSearch('hello world');

      expect(request).toHaveBeenCalledWith('/search?q=hello%20world&type=semantic');
    });

    it('应该返回搜索结果', async () => {
      vi.mocked(request).mockResolvedValue(mockSearchResult);

      const result = await searchApi.semanticSearch('test');

      expect(result).toEqual(mockSearchResult);
    });

    it('请求失败时应该抛出错误', async () => {
      const error = new Error('Network error');
      vi.mocked(request).mockRejectedValue(error);

      await expect(searchApi.semanticSearch('test')).rejects.toThrow('Network error');
    });
  });
});