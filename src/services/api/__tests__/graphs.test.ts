import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { CreateGraphData, UpdateGraphData } from '@shared/types/api';
import type { CreateGraphFromTemplateData } from '@shared/types/graph';

// --- Mocks ---

// Mock request function from ./client
vi.mock('../client', () => ({
  request: vi.fn(),
}));

// --- Imports (must be after vi.mock declarations) ---

import { graphsApi } from '../graphs';
import { request } from '../client';

// --- Tests ---

describe('graphsApi', () => {
  beforeEach(() => {
    vi.mocked(request).mockClear();
  });

  describe('基础查询', () => {
    it('应该调用 list 请求 /graphs 获取图谱列表', async () => {
      await graphsApi.list();
      expect(request).toHaveBeenCalledWith('/graphs');
    });

    it('应该调用 listTrash 请求 /graphs/trash 获取回收站列表', async () => {
      await graphsApi.listTrash();
      expect(request).toHaveBeenCalledWith('/graphs/trash');
    });

    it('应该调用 getTags 请求 /graphs/tags 获取标签列表', async () => {
      await graphsApi.getTags();
      expect(request).toHaveBeenCalledWith('/graphs/tags');
    });

    it('应该调用 getDomains 请求 /graphs/domains 获取领域列表', async () => {
      await graphsApi.getDomains();
      expect(request).toHaveBeenCalledWith('/graphs/domains');
    });

    it('应该调用 getMap 请求 /graphs/map 获取图谱地图', async () => {
      await graphsApi.getMap();
      expect(request).toHaveBeenCalledWith('/graphs/map');
    });
  });

  describe('单个资源获取（路径插值）', () => {
    it('应该调用 get 将 id 插值到路径 /graphs/{id}', async () => {
      await graphsApi.get('graph-123');
      expect(request).toHaveBeenCalledWith('/graphs/graph-123');
    });

    it('应该调用 getNodeStatus 请求 /graphs/{id}/node-status', async () => {
      await graphsApi.getNodeStatus('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/node-status');
    });

    it('应该调用 getLearningPath 请求 /graphs/{id}/learning-path', async () => {
      await graphsApi.getLearningPath('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/learning-path');
    });

    it('应该调用 analyze 请求 /graphs/{id}/analyze', async () => {
      await graphsApi.analyze('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/analyze');
    });

    it('应该调用 getModuleGaps 请求 /graphs/{id}/analysis/module-gaps', async () => {
      await graphsApi.getModuleGaps('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/analysis/module-gaps');
    });

    it('应该调用 getModuleOverlap 请求 /graphs/{id}/analysis/module-overlap', async () => {
      await graphsApi.getModuleOverlap('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/analysis/module-overlap');
    });

    it('应该调用 getRelations 请求 /graphs/{id}/relations', async () => {
      await graphsApi.getRelations('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/relations');
    });
  });

  describe('getNodes - URLSearchParams 构造', () => {
    it('应该在不传可选参数时请求 /graphs/{id}/nodes（无查询串）', async () => {
      await graphsApi.getNodes('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/nodes');
    });

    it('应该在 includeEmbedding=true 时附加 ?includeEmbedding=true', async () => {
      await graphsApi.getNodes('graph-1', true);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/nodes?includeEmbedding=true',
      );
    });

    it('应该在 includeStatus=true 时附加 ?includeStatus=true', async () => {
      await graphsApi.getNodes('graph-1', false, true);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/nodes?includeStatus=true',
      );
    });

    it('应该在两者都为 true 时附加 ?includeEmbedding=true&includeStatus=true', async () => {
      await graphsApi.getNodes('graph-1', true, true);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/nodes?includeEmbedding=true&includeStatus=true',
      );
    });
  });

  describe('创建与更新', () => {
    it('应该调用 create 以 POST 请求 /graphs 并传递 JSON body', async () => {
      const data: CreateGraphData = {
        title: '新图谱',
        description: '描述',
        domain: 'physics',
      };
      await graphsApi.create(data);
      expect(request).toHaveBeenCalledWith('/graphs', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 createFromTemplate 以 POST 请求 /templates/from-template', async () => {
      const data: CreateGraphFromTemplateData = {
        template_id: 'tpl-1',
        title: '从模板创建',
      };
      await graphsApi.createFromTemplate(data);
      expect(request).toHaveBeenCalledWith('/templates/from-template', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 update 以 PUT 请求 /graphs/{id} 并传递 JSON body', async () => {
      const data: UpdateGraphData = { title: '更新标题', domain: 'math' };
      await graphsApi.update('graph-1', data);
      expect(request).toHaveBeenCalledWith('/graphs/graph-1', {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    });
  });

  describe('toggle 类操作', () => {
    it('应该调用 togglePublic 以 PUT 请求 /graphs/{id}/share，body 为 { is_public }', async () => {
      await graphsApi.togglePublic('graph-1', true);
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/share', {
        method: 'PUT',
        body: JSON.stringify({ is_public: true }),
      });
    });

    it('应该调用 togglePublic 传递 false 值', async () => {
      await graphsApi.togglePublic('graph-1', false);
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/share', {
        method: 'PUT',
        body: JSON.stringify({ is_public: false }),
      });
    });

    it('应该调用 toggleFavorite 以 PUT 请求 /graphs/{id}/favorite，body 为 { is_favorite }', async () => {
      await graphsApi.toggleFavorite('graph-1', true);
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/favorite', {
        method: 'PUT',
        body: JSON.stringify({ is_favorite: true }),
      });
    });

    it('应该调用 updateViewMode 以 PUT 请求 /graphs/{id}/view-mode，body 为 { viewMode }', async () => {
      await graphsApi.updateViewMode('graph-1', 'force');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/view-mode', {
        method: 'PUT',
        body: JSON.stringify({ viewMode: 'force' }),
      });
    });
  });

  describe('删除与恢复', () => {
    it('应该调用 delete 以 DELETE 请求 /graphs/{id}', async () => {
      await graphsApi.delete('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1', {
        method: 'DELETE',
      });
    });

    it('应该调用 restore 以 POST 请求 /graphs/{id}/restore', async () => {
      await graphsApi.restore('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/restore', {
        method: 'POST',
      });
    });

    it('应该调用 permanentDelete 以 DELETE 请求 /graphs/{id}/permanent', async () => {
      await graphsApi.permanentDelete('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/permanent', {
        method: 'DELETE',
      });
    });
  });

  describe('batch 操作', () => {
    it('应该调用 batchRestore 以 POST 请求 /graphs/batch/restore，body 为 { ids }', async () => {
      const ids = ['g-1', 'g-2'];
      await graphsApi.batchRestore(ids);
      expect(request).toHaveBeenCalledWith('/graphs/batch/restore', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    });

    it('应该调用 batchDelete 以 POST 请求 /graphs/batch/delete，body 为 { ids }', async () => {
      const ids = ['g-1', 'g-2'];
      await graphsApi.batchDelete(ids);
      expect(request).toHaveBeenCalledWith('/graphs/batch/delete', {
        method: 'POST',
        body: JSON.stringify({ ids }),
      });
    });

    it('应该调用 batchPermanentDelete 以 DELETE 请求 /graphs/batch/permanent，body 为 { ids }', async () => {
      const ids = ['g-1', 'g-2'];
      await graphsApi.batchPermanentDelete(ids);
      expect(request).toHaveBeenCalledWith('/graphs/batch/permanent', {
        method: 'DELETE',
        body: JSON.stringify({ ids }),
      });
    });

    it('应该调用 batchGetNodeStatus 以 POST 请求 /graphs/batch-node-status，body 为 { graph_ids }', async () => {
      const graphIds = ['g-1', 'g-2'];
      await graphsApi.batchGetNodeStatus(graphIds);
      expect(request).toHaveBeenCalledWith('/graphs/batch-node-status', {
        method: 'POST',
        body: JSON.stringify({ graph_ids: graphIds }),
      });
    });
  });

  describe('checkTopic', () => {
    it('应该在传入 excludeGraphId 时 body 包含 exclude_graph_id', async () => {
      await graphsApi.checkTopic('量子力学', 'graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/check-topic', {
        method: 'POST',
        body: JSON.stringify({
          topic: '量子力学',
          exclude_graph_id: 'graph-1',
        }),
      });
    });

    it('应该在不传 excludeGraphId 时 exclude_graph_id 为 undefined', async () => {
      await graphsApi.checkTopic('量子力学');
      expect(request).toHaveBeenCalledWith('/graphs/check-topic', {
        method: 'POST',
        body: JSON.stringify({
          topic: '量子力学',
          exclude_graph_id: undefined,
        }),
      });
    });
  });

  describe('getLiterature - 可选 module 参数', () => {
    it('应该在不传 module 时请求 /graphs/{id}/literature（无查询串）', async () => {
      await graphsApi.getLiterature('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/literature');
    });

    it('应该在传 module 时附加 ?module={encodeURIComponent(module)}', async () => {
      await graphsApi.getLiterature('graph-1', 'machine learning');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/literature?module=machine%20learning',
      );
    });
  });

  describe('getMissingConnections - 可选 max 参数', () => {
    it('应该在不传 max 时请求 /graphs/{id}/missing-connections（无查询串）', async () => {
      await graphsApi.getMissingConnections('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/missing-connections');
    });

    it('应该在传 max 时附加 ?max={max}', async () => {
      await graphsApi.getMissingConnections('graph-1', 5);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/missing-connections?max=5',
      );
    });
  });

  describe('getIntelligentSuggestions - 可选 graphIds', () => {
    it('应该在不传 graphIds 时请求 /graphs/intelligent-suggestions（无查询串）', async () => {
      await graphsApi.getIntelligentSuggestions();
      expect(request).toHaveBeenCalledWith('/graphs/intelligent-suggestions');
    });

    it('应该在传入空数组时请求 /graphs/intelligent-suggestions（无查询串）', async () => {
      await graphsApi.getIntelligentSuggestions([]);
      expect(request).toHaveBeenCalledWith('/graphs/intelligent-suggestions');
    });

    it('应该在传入非空数组时附加 ?graph_ids={join(,)}', async () => {
      await graphsApi.getIntelligentSuggestions(['g-1', 'g-2']);
      expect(request).toHaveBeenCalledWith(
        '/graphs/intelligent-suggestions?graph_ids=g-1,g-2',
      );
    });
  });

  describe('前置图谱', () => {
    it('应该调用 createPrerequisiteGraph 以 POST 请求 /graphs/{id}/prerequisite-graph', async () => {
      const data = {
        topic: '微积分',
        description: '前置知识',
        auto_generate: true,
      };
      await graphsApi.createPrerequisiteGraph('graph-1', data);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/prerequisite-graph',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });

    it('应该调用 createPrerequisiteGraphs 传递完整 body（topics + depth + style）', async () => {
      const data = {
        topics: [
          { topic: '线性代数', mastery_level: 'beginner' },
          { topic: '概率论', mastery_level: 'intermediate' },
        ],
        depth: 3,
        style: 'academic' as const,
      };
      await graphsApi.createPrerequisiteGraphs('graph-1', data);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/prerequisite-graphs/batch',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });

    it('应该调用 createPrerequisiteGraphs 仅传 topics（无可选字段）', async () => {
      const data = {
        topics: [{ topic: '离散数学', mastery_level: 'beginner' }],
      };
      await graphsApi.createPrerequisiteGraphs('graph-1', data);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/prerequisite-graphs/batch',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('关系管理', () => {
    it('应该调用 createRelation 以 POST 请求 /graph-relations/relations（非 /graphs 前缀）', async () => {
      const data = {
        source_graph_id: 'g-1',
        target_graph_id: 'g-2',
        relation_type: 'prerequisite' as const,
        context: '前置关系',
      };
      await graphsApi.createRelation(data);
      expect(request).toHaveBeenCalledWith('/graph-relations/relations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 deleteRelation 以 DELETE 请求 /graphs/{graphId}/relations/{relationId}', async () => {
      await graphsApi.deleteRelation('graph-1', 'rel-9');
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/relations/rel-9',
        { method: 'DELETE' },
      );
    });

    it('应该调用 deleteRelationById 以 DELETE 请求 /graph-relations/relations/{relationId}（非 /graphs 前缀）', async () => {
      await graphsApi.deleteRelationById('rel-9');
      expect(request).toHaveBeenCalledWith(
        '/graph-relations/relations/rel-9',
        { method: 'DELETE' },
      );
    });
  });

  describe('infiniteExpand', () => {
    it('应该调用 infiniteExpand 以 POST 请求 /graphs/{graphId}/infinite-expand', async () => {
      const data = {
        max_depth: 3,
        max_graphs_per_level: 5,
        relation_types: ['prerequisite'],
        auto_generate_nodes: true,
        node_depth: 2,
      };
      await graphsApi.infiniteExpand('graph-1', data);
      expect(request).toHaveBeenCalledWith(
        '/graphs/graph-1/infinite-expand',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('域分析', () => {
    it('应该调用 analyzeDomain 使用默认 count=10', async () => {
      await graphsApi.analyzeDomain('physics');
      expect(request).toHaveBeenCalledWith('/graphs/domain/analyze', {
        method: 'POST',
        body: JSON.stringify({
          domain: 'physics',
          count: 10,
          session_id: undefined,
        }),
      });
    });

    it('应该调用 analyzeDomain 传递 count 与 sessionId', async () => {
      await graphsApi.analyzeDomain('physics', 20, 'session-1');
      expect(request).toHaveBeenCalledWith('/graphs/domain/analyze', {
        method: 'POST',
        body: JSON.stringify({
          domain: 'physics',
          count: 20,
          session_id: 'session-1',
        }),
      });
    });

    it('应该调用 expandDomain 使用默认 count=10', async () => {
      await graphsApi.expandDomain(['g-1']);
      expect(request).toHaveBeenCalledWith('/graphs/domain/expand', {
        method: 'POST',
        body: JSON.stringify({
          graph_ids: ['g-1'],
          count: 10,
          domain: undefined,
        }),
      });
    });

    it('应该调用 expandDomain 传递 count 与 domain', async () => {
      await graphsApi.expandDomain(['g-1', 'g-2'], 15, 'math');
      expect(request).toHaveBeenCalledWith('/graphs/domain/expand', {
        method: 'POST',
        body: JSON.stringify({
          graph_ids: ['g-1', 'g-2'],
          count: 15,
          domain: 'math',
        }),
      });
    });

    it('应该调用 batchCreateDomainGraphs 以 POST 请求 /graphs/domain/batch-create', async () => {
      const data = {
        graphs: [
          { title: '图论', description: '离散数学分支' },
          { title: '组合数学' },
        ],
        domain: 'math',
        relations: [
          {
            from_title: '图论',
            to_title: '组合数学',
            type: 'related' as const,
            reason: '相关领域',
          },
        ],
      };
      await graphsApi.batchCreateDomainGraphs(data);
      expect(request).toHaveBeenCalledWith('/graphs/domain/batch-create', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });
  });

  describe('初始化与发现', () => {
    it('应该调用 initializeGraph 使用默认 style=academic', async () => {
      await graphsApi.initializeGraph('graph-1');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/initialize', {
        method: 'POST',
        body: JSON.stringify({ style: 'academic' }),
      });
    });

    it('应该调用 initializeGraph 传递指定 style', async () => {
      await graphsApi.initializeGraph('graph-1', 'practical');
      expect(request).toHaveBeenCalledWith('/graphs/graph-1/initialize', {
        method: 'POST',
        body: JSON.stringify({ style: 'practical' }),
      });
    });

    it('应该调用 batchInitializeGraphs 以 POST 请求 /graphs/batch-initialize', async () => {
      const data = {
        graph_ids: ['g-1', 'g-2'],
        style: 'beginner' as const,
        session_id: 'sess-1',
      };
      await graphsApi.batchInitializeGraphs(data);
      expect(request).toHaveBeenCalledWith('/graphs/batch-initialize', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 discoverRelations 在无参数时 body 为空对象 {}', async () => {
      await graphsApi.discoverRelations();
      expect(request).toHaveBeenCalledWith('/graphs/discover-relations', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    });

    it('应该调用 discoverRelations 传递完整参数', async () => {
      const data = {
        graph_ids: ['g-1'],
        max_suggestions: 10,
        include_cross_domain: true,
      };
      await graphsApi.discoverRelations(data);
      expect(request).toHaveBeenCalledWith('/graphs/discover-relations', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    });

    it('应该调用 createDiscoveredRelation 以 POST 请求 /graphs/create-discovered-relation', async () => {
      const data = {
        source_graph_id: 'g-1',
        target_graph_id: 'g-2',
        relation_type: 'extension' as const,
        context: '扩展关系',
        confidence: 0.85,
        shared_concepts: ['concept-a'],
      };
      await graphsApi.createDiscoveredRelation(data);
      expect(request).toHaveBeenCalledWith(
        '/graphs/create-discovered-relation',
        {
          method: 'POST',
          body: JSON.stringify(data),
        },
      );
    });
  });

  describe('智能分析', () => {
    it('应该调用 getCrossDomainInsights 在无参数时 body 为空对象 {}', async () => {
      await graphsApi.getCrossDomainInsights();
      expect(request).toHaveBeenCalledWith('/graphs/cross-domain-insights', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    });

    it('应该调用 getCrossDomainInsights 传递 options', async () => {
      const options = { graph_ids: ['g-1'], min_intersection: 3 };
      await graphsApi.getCrossDomainInsights(options);
      expect(request).toHaveBeenCalledWith('/graphs/cross-domain-insights', {
        method: 'POST',
        body: JSON.stringify(options),
      });
    });

    it('应该调用 getLearningPathSuggestions 在无参数时 body 为空对象 {}', async () => {
      await graphsApi.getLearningPathSuggestions();
      expect(request).toHaveBeenCalledWith('/graphs/learning-path-suggestions', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    });

    it('应该调用 getLearningPathSuggestions 传递 options', async () => {
      const options = { graph_ids: ['g-1'], difficulty: 'advanced' as const };
      await graphsApi.getLearningPathSuggestions(options);
      expect(request).toHaveBeenCalledWith('/graphs/learning-path-suggestions', {
        method: 'POST',
        body: JSON.stringify(options),
      });
    });

    it('应该调用 getKnowledgeGaps 在无参数时 body 为空对象 {}', async () => {
      await graphsApi.getKnowledgeGaps();
      expect(request).toHaveBeenCalledWith('/graphs/knowledge-gaps', {
        method: 'POST',
        body: JSON.stringify({}),
      });
    });

    it('应该调用 getKnowledgeGaps 传递 options', async () => {
      const options = { graph_ids: ['g-1'], min_importance: 'high' as const };
      await graphsApi.getKnowledgeGaps(options);
      expect(request).toHaveBeenCalledWith('/graphs/knowledge-gaps', {
        method: 'POST',
        body: JSON.stringify(options),
      });
    });
  });
});
