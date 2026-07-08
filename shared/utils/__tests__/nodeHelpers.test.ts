import { describe, it, expect } from 'vitest';
import {
  getKnowledgePoint,
  buildNodeFromGraphNode,
  buildNodesFromGraphNodes,
  GRAPH_NODES_SELECT,
  GRAPH_NODES_SELECT_WITH_EMBEDDING,
} from '../nodeHelpers';
import type { KnowledgePoint, GraphNode } from '@shared/types/graph';

// 构造合法的 KnowledgePoint 测试数据
function makeKp(overrides: Partial<KnowledgePoint> = {}): KnowledgePoint {
  return {
    id: 'kp-1',
    title: '知识点',
    content: '内容',
    summary: '摘要',
    learning_material: '学习材料',
    visibility: 'private',
    owner_id: 'user-1',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    keywords: [],
    ...overrides,
  };
}

// 构造合法的 GraphNode 测试数据
function makeGraphNode(overrides: Partial<GraphNode> = {}): GraphNode {
  return {
    id: 'gn-1',
    graph_id: 'graph-1',
    knowledge_point_id: 'kp-1',
    x_position: 0,
    y_position: 0,
    level: 'normal',
    is_accepted: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('nodeHelpers', () => {
  describe('常量', () => {
    it('GRAPH_NODES_SELECT 包含基础字段（不含 embedding）', () => {
      expect(GRAPH_NODES_SELECT).toContain('id');
      expect(GRAPH_NODES_SELECT).toContain('knowledge_point_id');
      expect(GRAPH_NODES_SELECT).toContain('knowledge_points');
      expect(GRAPH_NODES_SELECT).not.toContain('embedding');
    });

    it('GRAPH_NODES_SELECT_WITH_EMBEDDING 包含 embedding 字段', () => {
      expect(GRAPH_NODES_SELECT_WITH_EMBEDDING).toContain('embedding');
      expect(GRAPH_NODES_SELECT_WITH_EMBEDDING).toContain('knowledge_points');
    });
  });

  describe('getKnowledgePoint', () => {
    it('传入对象直接返回', () => {
      const kp = makeKp();
      expect(getKnowledgePoint(kp)).toBe(kp);
    });

    it('传入数组返回首个元素', () => {
      const kp1 = makeKp({ id: 'kp-1' });
      const kp2 = makeKp({ id: 'kp-2' });
      expect(getKnowledgePoint([kp1, kp2])).toBe(kp1);
    });

    it('传入空数组返回 null', () => {
      expect(getKnowledgePoint([])).toBeNull();
    });

    it('传入 null 返回 null', () => {
      expect(getKnowledgePoint(null)).toBeNull();
    });
  });

  describe('buildNodeFromGraphNode', () => {
    it('null 输入返回 null', () => {
      expect(buildNodeFromGraphNode(null)).toBeNull();
    });

    it('无 knowledge_point 且无 knowledge_points 时返回 null', () => {
      const gn = { ...makeGraphNode(), knowledge_point: null, knowledge_points: null };
      expect(buildNodeFromGraphNode(gn)).toBeNull();
    });

    it('从 knowledge_point 构建 Node', () => {
      const kp = makeKp({ title: '测试知识点' });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: kp,
        knowledge_points: null,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node).not.toBeNull();
      expect(node?.title).toBe('测试知识点');
      expect(node?.id).toBe('kp-1');
      expect(node?.knowledge_point_id).toBe('kp-1');
    });

    it('从 knowledge_points（对象）构建 Node', () => {
      const kp = makeKp({ title: '从数组字段构建' });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: null,
        knowledge_points: kp,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node).not.toBeNull();
      expect(node?.title).toBe('从数组字段构建');
    });

    it('从 knowledge_points（数组）构建 Node，取首个', () => {
      const kp1 = makeKp({ id: 'kp-1', title: '第一个' });
      const kp2 = makeKp({ id: 'kp-2', title: '第二个' });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: null,
        knowledge_points: [kp1, kp2],
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node).not.toBeNull();
      expect(node?.title).toBe('第一个');
    });

    it('knowledge_point 优先于 knowledge_points', () => {
      const kpPriority = makeKp({ id: 'kp-priority', title: '优先' });
      const kpFallback = makeKp({ id: 'kp-fallback', title: '后备' });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: kpPriority,
        knowledge_points: kpFallback,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node?.title).toBe('优先');
    });

    it('构建的 Node 包含 GraphNode 字段', () => {
      const kp = makeKp();
      const gn = {
        ...makeGraphNode({
          graph_id: 'g-100',
          x_position: 10,
          y_position: 20,
          level: 'root',
          is_accepted: false,
        }),
        knowledge_point: kp,
        knowledge_points: null,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node?.graph_id).toBe('g-100');
      expect(node?.x_position).toBe(10);
      expect(node?.y_position).toBe(20);
      expect(node?.level).toBe('root');
      expect(node?.is_accepted).toBe(false);
    });

    it('构建的 Node 包含 KnowledgePoint 字段', () => {
      const kp = makeKp({
        title: '标题',
        content: '内容',
        summary: '摘要',
        visibility: 'public',
        owner_id: 'owner-1',
      });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: kp,
        knowledge_points: null,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node?.title).toBe('标题');
      expect(node?.content).toBe('内容');
      expect(node?.summary).toBe('摘要');
      expect(node?.visibility).toBe('public');
      expect(node?.owner_id).toBe('owner-1');
    });

    it('缺失可选字段时使用默认值', () => {
      const kp = makeKp({
        title: '',
        content: undefined,
        summary: undefined,
        keywords: undefined,
        properties: undefined,
      });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: kp,
        knowledge_points: null,
      };
      const node = buildNodeFromGraphNode(gn);
      // 空值合并为默认值
      expect(node?.content).toBe('');
      expect(node?.summary).toBe('');
      expect(node?.keywords).toEqual([]);
      expect(node?.properties).toEqual({});
    });

    it('embedding 为数组时直接保留', () => {
      const kp = makeKp({ embedding: [0.1, 0.2, 0.3] });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: kp,
        knowledge_points: null,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node?.embedding).toEqual([0.1, 0.2, 0.3]);
    });

    it('embedding 为 JSON 字符串时被解析', () => {
      const kp = makeKp({
        embedding: JSON.parse(JSON.stringify([0.4, 0.5, 0.6])),
      });
      const gn = {
        ...makeGraphNode(),
        knowledge_point: kp,
        knowledge_points: null,
      };
      const node = buildNodeFromGraphNode(gn);
      expect(node?.embedding).toEqual([0.4, 0.5, 0.6]);
    });
  });

  describe('buildNodesFromGraphNodes', () => {
    it('空数组返回空数组', () => {
      expect(buildNodesFromGraphNodes([])).toEqual([]);
    });

    it('过滤掉无 knowledge_point 的 GraphNode', () => {
      const validKp = makeKp({ title: '有效' });
      const validGn = {
        ...makeGraphNode(),
        knowledge_point: validKp,
        knowledge_points: null,
      };
      const invalidGn = {
        ...makeGraphNode({ id: 'gn-2' }),
        knowledge_point: null,
        knowledge_points: null,
      };
      const result = buildNodesFromGraphNodes([validGn, invalidGn]);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('有效');
    });

    it('保留所有有效节点', () => {
      const kp1 = makeKp({ id: 'kp-1', title: '一' });
      const kp2 = makeKp({ id: 'kp-2', title: '二' });
      const gn1 = {
        ...makeGraphNode({ knowledge_point_id: 'kp-1' }),
        knowledge_point: kp1,
        knowledge_points: null,
      };
      const gn2 = {
        ...makeGraphNode({ id: 'gn-2', knowledge_point_id: 'kp-2' }),
        knowledge_point: kp2,
        knowledge_points: null,
      };
      const result = buildNodesFromGraphNodes([gn1, gn2]);
      expect(result).toHaveLength(2);
      expect(result.map((n) => n.title)).toEqual(['一', '二']);
    });
  });
});
