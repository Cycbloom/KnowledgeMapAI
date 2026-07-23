import { describe, it, expect, vi, beforeEach } from 'vitest';
import type {
  CreateNodeData,
  UpdateNodeData,
  CreateEdgeData,
  NodePositionUpdate,
} from '@shared/types/api';

// --- Mocks ---

// Mock request function from ./client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { nodesApi, edgesApi } from '../nodes';
import { request } from '../client';

// --- Tests ---

describe('nodesApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('create', () => {
    it('应该以 POST 方式调用 /nodes 并携带 JSON 序列化的 body', () => {
      const data: CreateNodeData = {
        graph_id: 'g1',
        title: '节点1',
        content: '内容',
      };

      nodesApi.create(data);

      expect(request).toHaveBeenCalledWith('/nodes', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('get', () => {
    it('应该调用 GET /nodes/${id}', () => {
      nodesApi.get('n1');

      expect(request).toHaveBeenCalledWith('/nodes/n1');
    });
  });

  describe('update', () => {
    it('应该以 PUT 方式调用 /nodes/${id} 并携带 JSON 序列化的 body', () => {
      const data: UpdateNodeData = {
        title: '更新标题',
        content: '更新内容',
      };

      nodesApi.update('n1', data);

      expect(request).toHaveBeenCalledWith('/nodes/n1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('delete', () => {
    it('应该在无 hardDelete 参数时调用 DELETE /nodes/${id}', () => {
      nodesApi.delete('n1');

      expect(request).toHaveBeenCalledWith('/nodes/n1', {
        method: 'DELETE',
      });
    });

    it('应该在 hardDelete 为 true 时调用 DELETE /nodes/${id}?hard_delete=true', () => {
      nodesApi.delete('n1', true);

      expect(request).toHaveBeenCalledWith('/nodes/n1?hard_delete=true', {
        method: 'DELETE',
      });
    });
  });

  describe('batchDelete', () => {
    it('应该在无 options 时以 body { node_ids } 调用 POST /nodes/batch-delete', () => {
      nodesApi.batchDelete(['n1', 'n2']);

      expect(request).toHaveBeenCalledWith('/nodes/batch-delete', {
        method: 'POST',
        body: JSON.stringify({ node_ids: ['n1', 'n2'] }),
      });
    });

    it('应该在传入 options { hard_delete: true } 时以 body { node_ids, hard_delete: true } 调用', () => {
      nodesApi.batchDelete(['n1', 'n2'], { hard_delete: true });

      expect(request).toHaveBeenCalledWith('/nodes/batch-delete', {
        method: 'POST',
        body: JSON.stringify({
          node_ids: ['n1', 'n2'],
          hard_delete: true,
        }),
      });
    });
  });

  describe('batchUpdatePositions', () => {
    it('应该以 body { positions } 调用 POST /nodes/batch-update-positions', () => {
      const positions: NodePositionUpdate[] = [
        { id: 'n1', x_position: 10, y_position: 20 },
        { id: 'n2', x_position: 30, y_position: 40 },
      ];

      nodesApi.batchUpdatePositions(positions);

      expect(request).toHaveBeenCalledWith('/nodes/batch-update-positions', {
        method: 'POST',
        body: JSON.stringify({ positions }),
      });
    });
  });

  describe('getRelated', () => {
    it('应该调用 GET /nodes/${id}/related', () => {
      nodesApi.getRelated('n1');

      expect(request).toHaveBeenCalledWith('/nodes/n1/related');
    });
  });

  describe('searchSimilar', () => {
    it('应该以 POST 方式调用 /nodes/search-similar 并携带 JSON 序列化的 params', () => {
      const params = {
        title: '搜索标题',
        content: '内容',
        threshold: 0.8,
        limit: 5,
      };

      nodesApi.searchSimilar(params);

      expect(request).toHaveBeenCalledWith('/nodes/search-similar', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    });
  });

  describe('getKnowledgePointGraphs', () => {
    it('应该以 GET 方式调用 /nodes/${nodeId}/knowledge-point-graphs', () => {
      nodesApi.getKnowledgePointGraphs('n1');

      expect(request).toHaveBeenCalledWith(
        '/nodes/n1/knowledge-point-graphs',
        { method: 'GET' },
      );
    });
  });
});

describe('edgesApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('create', () => {
    it('应该以 POST 方式调用 /edges 并携带 JSON 序列化的 body', () => {
      const data: CreateEdgeData = {
        source_knowledge_point_id: 'kp1',
        target_knowledge_point_id: 'kp2',
        graph_id: 'g1',
      };

      edgesApi.create(data);

      expect(request).toHaveBeenCalledWith('/edges', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('delete', () => {
    it('应该调用 DELETE /edges/${id}', () => {
      edgesApi.delete('e1');

      expect(request).toHaveBeenCalledWith('/edges/e1', {
        method: 'DELETE',
      });
    });
  });
});
