import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks ---

// Mock request function from ../client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { domainsApi, graphDomainsApi } from '../domains';
import {
  regionsApi,
  type CreateRegionData,
  type UpdateRegionData,
} from '../regions';
import { searchApi } from '../search';
import { taskRecommendationApi } from '../taskRecommendation';
import { request } from '../client';

// --- Tests ---

describe('domainsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getTree', () => {
    it('应该以 GET 请求 /domains', async () => {
      await domainsApi.getTree();
      expect(request).toHaveBeenCalledWith('/domains', { method: 'GET' });
    });
  });

  describe('getById', () => {
    it('应该以 GET 请求 /domains/{domainId}', async () => {
      await domainsApi.getById('domain-1');
      expect(request).toHaveBeenCalledWith('/domains/domain-1', {
        method: 'GET',
      });
    });
  });

  describe('create', () => {
    it('应该以 POST 请求 /domains 并传递 JSON body', async () => {
      const data = {
        name: '新领域',
        color: '#ff0000',
        description: '描述',
        parent_id: 'parent-1',
        icon: 'icon',
      };
      await domainsApi.create(data);
      expect(request).toHaveBeenCalledWith('/domains', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('update', () => {
    it('应该以 PUT 请求 /domains/{domainId} 并传递 JSON body', async () => {
      const data = {
        name: '更新名称',
        sort_order: 1,
      };
      await domainsApi.update('domain-1', data);
      expect(request).toHaveBeenCalledWith('/domains/domain-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('delete', () => {
    it('应该以 DELETE 请求 /domains/{domainId}', async () => {
      await domainsApi.delete('domain-1');
      expect(request).toHaveBeenCalledWith('/domains/domain-1', {
        method: 'DELETE',
      });
    });
  });

  describe('ensureUncategorized', () => {
    it('应该以 GET 请求 /api/domains/ensure-uncategorized', async () => {
      await domainsApi.ensureUncategorized();
      expect(request).toHaveBeenCalledWith(
        '/api/domains/ensure-uncategorized',
        { method: 'GET' },
      );
    });
  });

  describe('reorder', () => {
    it('应该以 PUT 请求 /domains/reorder 并传递 reorder_items body', async () => {
      const data = {
        reorder_items: [
          { id: 'domain-1', parent_id: null, sort_order: 0 },
          { id: 'domain-2', sort_order: 1 },
        ],
      };
      await domainsApi.reorder(data);
      expect(request).toHaveBeenCalledWith('/domains/reorder', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('generateColor', () => {
    it('应该以 POST 请求 /domains/generate-color 并传递 name 与 description', async () => {
      await domainsApi.generateColor('数学', '一门学科');
      expect(request).toHaveBeenCalledWith('/domains/generate-color', {
        method: 'POST',
        body: JSON.stringify({ name: '数学', description: '一门学科' }),
      });
    });

    it('应该在没有 description 时仅传递 name', async () => {
      await domainsApi.generateColor('数学');
      expect(request).toHaveBeenCalledWith('/domains/generate-color', {
        method: 'POST',
        body: JSON.stringify({ name: '数学', description: undefined }),
      });
    });
  });

  describe('recommendDomains', () => {
    it('应该以 POST 请求 /domains/recommend 并传递 title 与 description', async () => {
      await domainsApi.recommendDomains('节点标题', '节点描述');
      expect(request).toHaveBeenCalledWith('/domains/recommend', {
        method: 'POST',
        body: JSON.stringify({ title: '节点标题', description: '节点描述' }),
      });
    });

    it('应该在没有 description 时仅传递 title', async () => {
      await domainsApi.recommendDomains('节点标题');
      expect(request).toHaveBeenCalledWith('/domains/recommend', {
        method: 'POST',
        body: JSON.stringify({ title: '节点标题', description: undefined }),
      });
    });
  });
});

describe('graphDomainsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getByGraphId', () => {
    it('应该以 GET 请求 /graphs/{graphId}/domains', async () => {
      await graphDomainsApi.getByGraphId('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/domains', {
        method: 'GET',
      });
    });
  });

  describe('updateByGraphId', () => {
    it('应该以 PUT 请求 /graphs/{graphId}/domains 并传递 domains body', async () => {
      const domains = [
        { domain_id: 'domain-1', is_primary: true },
        { domain_id: 'domain-2' },
      ];
      await graphDomainsApi.updateByGraphId('graph-1', domains);
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/domains', {
        method: 'PUT',
        body: JSON.stringify({ domains }),
      });
    });
  });
});

describe('regionsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('list', () => {
    it('应该请求 /graphs/{graphId}/regions', async () => {
      await regionsApi.list('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/regions');
    });
  });

  describe('create', () => {
    it('应该以 POST 请求 /graphs/{graphId}/regions 并传递 JSON body', async () => {
      const data: CreateRegionData = {
        name: '区域1',
        color: '#00ff00',
        nodeIds: ['node-1', 'node-2'],
      };
      await regionsApi.create('graph-1', data);
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/regions', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('update', () => {
    it('应该以 PATCH 请求 /graphs/{graphId}/regions/{regionId} 并传递 JSON body', async () => {
      const data: UpdateRegionData = {
        name: '更新名称',
        nodeIds: ['node-3'],
      };
      await regionsApi.update('graph-1', 'region-1', data);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/regions/region-1',
        {
          method: 'PATCH',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('delete', () => {
    it('应该以 DELETE 请求 /graphs/{graphId}/regions/{regionId}', async () => {
      await regionsApi.delete('graph-1', 'region-1');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/regions/region-1',
        { method: 'DELETE' },
      );
    });
  });

  describe('updateViewMode', () => {
    it('应该以 PUT 请求 /graphs/{graphId}/view-mode 并传递 viewMode body', async () => {
      await regionsApi.updateViewMode('graph-1', 'mindmap');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/view-mode', {
        method: 'PUT',
        body: JSON.stringify({ viewMode: 'mindmap' }),
      });
    });
  });
});

describe('searchApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('search', () => {
    it('应该请求 /search?q={encodedQuery}', async () => {
      await searchApi.search('知识图谱');
      expect(request).toHaveBeenCalledWith(
        `/search?q=${encodeURIComponent('知识图谱')}`,
      );
    });

    it('应该对包含特殊字符的查询进行 URL 编码', async () => {
      await searchApi.search('a b&c');
      expect(request).toHaveBeenCalledWith(
        `/search?q=${encodeURIComponent('a b&c')}`,
      );
    });
  });

  describe('semanticSearch', () => {
    it('应该请求 /search?q={encodedQuery}&type=semantic', async () => {
      await searchApi.semanticSearch('深度学习');
      expect(request).toHaveBeenCalledWith(
        `/search?q=${encodeURIComponent('深度学习')}&type=semantic`,
      );
    });
  });
});

describe('taskRecommendationApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('getRecommendations', () => {
    it('应该请求 /scheduler/recommendations', async () => {
      await taskRecommendationApi.getRecommendations();
      expect(request).toHaveBeenCalledWith('/scheduler/recommendations');
    });
  });

  describe('getSmartSuggestions', () => {
    it('应该请求 /scheduler/smart-suggestions', async () => {
      await taskRecommendationApi.getSmartSuggestions();
      expect(request).toHaveBeenCalledWith('/scheduler/smart-suggestions');
    });
  });

  describe('analyzePriority', () => {
    it('应该以 POST 请求 /scheduler/analyze-priority 并传递 title 与 description', async () => {
      await taskRecommendationApi.analyzePriority('任务标题', '任务描述');
      expect(request).toHaveBeenCalledWith('/scheduler/analyze-priority', {
        method: 'POST',
        body: JSON.stringify({ title: '任务标题', description: '任务描述' }),
      });
    });

    it('应该在没有 description 时仅传递 title', async () => {
      await taskRecommendationApi.analyzePriority('任务标题');
      expect(request).toHaveBeenCalledWith('/scheduler/analyze-priority', {
        method: 'POST',
        body: JSON.stringify({ title: '任务标题', description: undefined }),
      });
    });
  });

  describe('getEfficiencyData', () => {
    it('应该在不传 days 时使用默认值 30', async () => {
      await taskRecommendationApi.getEfficiencyData();
      expect(request).toHaveBeenCalledWith(
        '/scheduler/efficiency-data?days=30',
      );
    });

    it('应该在传入 days 时附加 ?days={value}', async () => {
      await taskRecommendationApi.getEfficiencyData(7);
      expect(request).toHaveBeenCalledWith(
        '/scheduler/efficiency-data?days=7',
      );
    });
  });

  describe('getDecisionRecommendations', () => {
    it('应该在不传 limit 时使用默认值 5', async () => {
      await taskRecommendationApi.getDecisionRecommendations();
      expect(request).toHaveBeenCalledWith(
        '/scheduler/decision-engine/recommendations?limit=5',
      );
    });

    it('应该在传入 limit 时附加 ?limit={value}', async () => {
      await taskRecommendationApi.getDecisionRecommendations(10);
      expect(request).toHaveBeenCalledWith(
        '/scheduler/decision-engine/recommendations?limit=10',
      );
    });
  });
});
