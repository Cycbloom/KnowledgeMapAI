import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import {
  knowledgePointsApi,
  graphNodesApi,
  combinedViewApi,
} from '../knowledgePoints';
import { request } from '../client';

// --- Tests ---

describe('knowledgePointsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list - 可选 visibility 参数', () => {
    it('应该在不传参数时请求 /knowledge-points（无查询串）', async () => {
      await knowledgePointsApi.list();
      expect(request).toHaveBeenCalledWith('/knowledge-points', {
        method: 'GET',
      });
    });

    it('应该在传入 visibility 时附加 ?visibility={visibility}', async () => {
      await knowledgePointsApi.list({ visibility: 'private' });
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points?visibility=private',
        { method: 'GET' },
      );
    });
  });

  describe('单个资源获取（路径插值）', () => {
    it('应该调用 get 将 id 插值到路径 /knowledge-points/{id}', async () => {
      await knowledgePointsApi.get('kp-1');
      expect(request).toHaveBeenCalledWith('/knowledge-points/kp-1', {
        method: 'GET',
      });
    });

    it('应该调用 getWithGraphs 请求 /knowledge-points/{id}/graphs', async () => {
      await knowledgePointsApi.getWithGraphs('kp-1');
      expect(request).toHaveBeenCalledWith('/knowledge-points/kp-1/graphs', {
        method: 'GET',
      });
    });

    it('应该调用 getGraphs 请求 /knowledge-points/{id}/graphs', async () => {
      await knowledgePointsApi.getGraphs('kp-1');
      expect(request).toHaveBeenCalledWith('/knowledge-points/kp-1/graphs', {
        method: 'GET',
      });
    });
  });

  describe('创建与更新', () => {
    it('应该调用 create 以 POST 请求 /knowledge-points 并传递 JSON body（仅必填字段）', async () => {
      const data = { title: '知识点标题' };
      await knowledgePointsApi.create(data);
      expect(request).toHaveBeenCalledWith('/knowledge-points', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 create 传递完整 body（含可选字段）', async () => {
      const data = {
        title: '知识点标题',
        content: '内容',
        summary: '摘要',
        learning_material: '学习材料',
        properties: { key: 'value' },
        visibility: 'public' as const,
      };
      await knowledgePointsApi.create(data);
      expect(request).toHaveBeenCalledWith('/knowledge-points', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 update 以 PUT 请求 /knowledge-points/{id} 并传递 JSON body', async () => {
      const data = { title: '更新标题', content: '更新内容' };
      await knowledgePointsApi.update('kp-1', data);
      expect(request).toHaveBeenCalledWith('/knowledge-points/kp-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 update 仅传递 visibility 字段', async () => {
      const data = { visibility: 'pending' as const };
      await knowledgePointsApi.update('kp-1', data);
      expect(request).toHaveBeenCalledWith('/knowledge-points/kp-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('相似搜索', () => {
    it('应该调用 searchSimilar 以 POST 请求 /knowledge-points/search-similar（仅 query）', async () => {
      const params = { query: '微积分' };
      await knowledgePointsApi.searchSimilar(params);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/search-similar',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
      );
    });

    it('应该调用 searchSimilar 传递完整参数（含 threshold 与 limit）', async () => {
      const params = { query: '微积分', threshold: 0.8, limit: 10 };
      await knowledgePointsApi.searchSimilar(params);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/search-similar',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
      );
    });

    it('应该调用 searchSimilarByEmbedding 以 POST 请求 /knowledge-points/search-similar-embedding（仅 embedding）', async () => {
      const params = { embedding: [0.1, 0.2, 0.3] };
      await knowledgePointsApi.searchSimilarByEmbedding(params);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/search-similar-embedding',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
      );
    });

    it('应该调用 searchSimilarByEmbedding 传递完整参数', async () => {
      const params = { embedding: [0.1, 0.2], threshold: 0.7, limit: 5 };
      await knowledgePointsApi.searchSimilarByEmbedding(params);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/search-similar-embedding',
        {
          method: 'POST',
          body: JSON.stringify(params),
        },
      );
    });
  });

  describe('删除操作', () => {
    it('应该调用 softDeleteFromGraph 以 DELETE 请求 /graph-nodes/{id}/soft-delete', async () => {
      await knowledgePointsApi.softDeleteFromGraph('gn-1');
      expect(request).toHaveBeenCalledWith(
        '/graph-nodes/gn-1/soft-delete',
        { method: 'DELETE' },
      );
    });

    it('应该调用 hardDelete 以 DELETE 请求 /knowledge-points/{id}/hard-delete', async () => {
      await knowledgePointsApi.hardDelete('kp-1');
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/hard-delete',
        { method: 'DELETE' },
      );
    });
  });

  describe('版本管理', () => {
    it('应该调用 getVersions 在不传参数时请求 /knowledge-points/{id}/versions', async () => {
      await knowledgePointsApi.getVersions('kp-1');
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions',
        { method: 'GET' },
      );
    });

    it('应该调用 getVersions 传入 limit 时附加 ?limit={limit}', async () => {
      await knowledgePointsApi.getVersions('kp-1', { limit: 10 });
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions?limit=10',
        { method: 'GET' },
      );
    });

    it('应该调用 getVersions 传入 offset 时附加 ?offset={offset}', async () => {
      await knowledgePointsApi.getVersions('kp-1', { offset: 5 });
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions?offset=5',
        { method: 'GET' },
      );
    });

    it('应该调用 getVersions 同时传入 limit 与 offset 时附加 ?limit=&offset=', async () => {
      await knowledgePointsApi.getVersions('kp-1', { limit: 10, offset: 5 });
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions?limit=10&offset=5',
        { method: 'GET' },
      );
    });

    it('应该调用 getVersion 请求 /knowledge-points/{id}/versions/{versionNumber}', async () => {
      await knowledgePointsApi.getVersion('kp-1', 3);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions/3',
        { method: 'GET' },
      );
    });

    it('应该调用 compareVersions 请求 /knowledge-points/{id}/versions/compare?version1=&version2=', async () => {
      await knowledgePointsApi.compareVersions('kp-1', 1, 2);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions/compare?version1=1&version2=2',
        { method: 'GET' },
      );
    });

    it('应该调用 rollbackVersion 以 POST 请求 /knowledge-points/{id}/versions/{versionNumber}/rollback', async () => {
      await knowledgePointsApi.rollbackVersion('kp-1', 2);
      expect(request).toHaveBeenCalledWith(
        '/knowledge-points/kp-1/versions/2/rollback',
        { method: 'POST' },
      );
    });

    it('应该调用 createVersion 以 POST 请求 /knowledge-points/{id}/versions，body 为 { change_summary }', async () => {
      await knowledgePointsApi.createVersion('kp-1', '修改了标题');
      expect(request).toHaveBeenCalledWith('/knowledge-points/kp-1/versions', {
        method: 'POST',
        body: JSON.stringify({ change_summary: '修改了标题' }),
      });
    });
  });
});

describe('graphNodesApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  it('应该调用 create 以 POST 请求 /graph-nodes 并传递 JSON body（仅必填字段）', async () => {
    const data = { graph_id: 'g-1', knowledge_point_id: 'kp-1' };
    await graphNodesApi.create(data);
    expect(request).toHaveBeenCalledWith('/graph-nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('应该调用 create 传递完整 body（含可选字段）', async () => {
    const data = {
      graph_id: 'g-1',
      knowledge_point_id: 'kp-1',
      x_position: 100,
      y_position: 200,
      level: 'beginner',
      is_accepted: true,
    };
    await graphNodesApi.create(data);
    expect(request).toHaveBeenCalledWith('/graph-nodes', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('应该调用 get 请求 /graph-nodes/{id}', async () => {
    await graphNodesApi.get('gn-1');
    expect(request).toHaveBeenCalledWith('/graph-nodes/gn-1', {
      method: 'GET',
    });
  });

  it('应该调用 update 以 PUT 请求 /graph-nodes/{id} 并传递 JSON body', async () => {
    const data = { x_position: 150, y_position: 250 };
    await graphNodesApi.update('gn-1', data);
    expect(request).toHaveBeenCalledWith('/graph-nodes/gn-1', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  });

  it('应该调用 delete 以 DELETE 请求 /graph-nodes/{id}', async () => {
    await graphNodesApi.delete('gn-1');
    expect(request).toHaveBeenCalledWith('/graph-nodes/gn-1', {
      method: 'DELETE',
    });
  });

  it('应该调用 batchUpdatePositions 以 POST 请求 /graph-nodes/batch-update-positions，body 为 { positions }', async () => {
    const positions = [
      { id: 'gn-1', x_position: 10, y_position: 20 },
      { id: 'gn-2', x_position: 30, y_position: 40 },
    ];
    await graphNodesApi.batchUpdatePositions(positions);
    expect(request).toHaveBeenCalledWith(
      '/graph-nodes/batch-update-positions',
      {
        method: 'POST',
        body: JSON.stringify({ positions }),
      },
    );
  });

  it('应该调用 listByGraph 请求 /graphs/{graphId}/nodes', async () => {
    await graphNodesApi.listByGraph('g-1');
    expect(request).toHaveBeenCalledWith('/graphs/g-1/nodes', {
      method: 'GET',
    });
  });

  it('应该调用 addExistingKnowledgePoint 以 POST 请求 /graph-nodes/add-existing（仅必填字段）', async () => {
    const data = { graph_id: 'g-1', knowledge_point_id: 'kp-1' };
    await graphNodesApi.addExistingKnowledgePoint(data);
    expect(request).toHaveBeenCalledWith('/graph-nodes/add-existing', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });

  it('应该调用 addExistingKnowledgePoint 传递完整 body', async () => {
    const data = {
      graph_id: 'g-1',
      knowledge_point_id: 'kp-1',
      x_position: 50,
      y_position: 60,
      level: 'advanced',
    };
    await graphNodesApi.addExistingKnowledgePoint(data);
    expect(request).toHaveBeenCalledWith('/graph-nodes/add-existing', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  });
});

describe('combinedViewApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  it('应该调用 getData 以 POST 请求 /combined-view，body 为 { graph_ids }', async () => {
    const graphIds = ['g-1', 'g-2'];
    await combinedViewApi.getData(graphIds);
    expect(request).toHaveBeenCalledWith('/combined-view', {
      method: 'POST',
      body: JSON.stringify({ graph_ids: graphIds }),
    });
  });
});
