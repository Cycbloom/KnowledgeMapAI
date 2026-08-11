import { describe, it, expect } from 'vitest';
import {
  analyzeGraph,
  findMissingConnections,
  calculateGlobalMaxDegree,
  calculateGlobalMaxChildren,
  calculateNodeImportance,
  calculateEdgeStrength,
} from '../analysis';
import type { Node, Edge } from '../../../types';

const baseNode = (id: string, title: string, level: Node['level'], content = 'content'): Node => ({
  id,
  graph_id: 'g1',
  knowledge_point_id: `kp_${id}`,
  x_position: 0,
  y_position: 0,
  level,
  is_accepted: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  title,
  content,
  visibility: 'private',
  owner_id: 'user-1',
});

const baseEdge = (id: string, source: string, target: string, relationshipType = 'contains'): Edge => ({
  id,
  graph_id: 'g1',
  source_knowledge_point_id: source,
  target_knowledge_point_id: target,
  relationship_type: relationshipType,
});

describe('analyzeGraph', () => {
  it('返回空图确定性结果', () => {
    const result = analyzeGraph([], []);
    expect(result.nodeCount).toBe(0);
    expect(result.edgeCount).toBe(0);
    expect(result.isolatedNodes).toEqual([]);
    expect(result.disconnectedComponents).toBe(0);
    expect(result.maxDepth).toBe(0);
    expect(result.avgDepth).toBe(0);
    expect(result.levelDistribution).toEqual({ root: 0, core: 0, sub: 0, normal: 0, leaf: 0 });
    expect(result.avgDegree).toBe(0);
    expect(result.maxDegree).toBe(0);
    expect(result.minDegree).toBe(0);
    expect(result.centralNodes).toEqual([]);
    expect(result.rootNodes).toEqual([]);
    expect(result.leafNodes).toEqual([]);
    expect(result.nodesWithoutContent).toEqual([]);
    expect(result.nodesWithManyChildren).toEqual([]);
    expect(result.healthScore).toBe(80);
    expect(result.healthIssues).toEqual(['缺少根节点', '平均连接度较低']);
  });

  it('单节点无连接图', () => {
    const node = baseNode('A', 'Node A', 'root');
    const result = analyzeGraph([node], []);
    expect(result.nodeCount).toBe(1);
    expect(result.edgeCount).toBe(0);
    expect(result.isolatedNodes).toEqual(['A']);
    expect(result.disconnectedComponents).toBe(1);
    expect(result.maxDepth).toBe(0);
    expect(result.avgDepth).toBe(0);
    expect(result.maxDegree).toBe(0);
    expect(result.rootNodes).toEqual(['A']);
    expect(result.leafNodes).toEqual(['A']);
    expect(result.nodesWithoutContent).toEqual([]);
    expect(result.healthScore).toBe(88);
    expect(result.healthIssues).toEqual(['1 个孤立节点', '平均连接度较低']);
  });

  it('已知拓扑图：A->B, A->C, B->D', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'leaf'),
      baseNode('D', 'Node D', 'leaf'),
    ];
    const edges = [
      baseEdge('e1', 'A', 'B'),
      baseEdge('e2', 'A', 'C'),
      baseEdge('e3', 'B', 'D'),
    ];

    const result = analyzeGraph(nodes, edges);
    expect(result.nodeCount).toBe(4);
    expect(result.edgeCount).toBe(3);
    expect(result.disconnectedComponents).toBe(1);
    expect(result.isolatedNodes).toEqual([]);
    expect(result.maxDepth).toBe(2);
    expect(result.avgDepth).toBe(1);
    expect(result.maxDegree).toBe(2);
    expect(result.minDegree).toBe(1);
    expect(result.avgDegree).toBe(1.5);
    expect(result.levelDistribution).toEqual({ root: 1, core: 1, sub: 0, normal: 0, leaf: 2 });
    expect(result.rootNodes).toEqual(['A']);
    expect(result.leafNodes).toEqual(['C', 'D']);
    expect(result.centralNodes).toEqual([
      { id: 'A', degree: 2, title: 'Node A' },
      { id: 'B', degree: 2, title: 'Node B' },
      { id: 'C', degree: 1, title: 'Node C' },
      { id: 'D', degree: 1, title: 'Node D' },
    ]);
    expect(result.nodesWithoutContent).toEqual([]);
    expect(result.nodesWithManyChildren).toEqual([]);
    expect(result.healthScore).toBe(100);
    expect(result.healthIssues).toEqual(['图谱结构健康']);
  });

  it('多条边累加度并识别孤立节点', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'leaf'),
      baseNode('ISO', 'Isolated', 'normal'),
    ];
    const edges = [
      baseEdge('e1', 'A', 'B'),
      baseEdge('e2', 'A', 'B'),
      baseEdge('e3', 'B', 'C'),
    ];
    const result = analyzeGraph(nodes, edges);
    expect(result.nodeCount).toBe(4);
    expect(result.edgeCount).toBe(3);
    expect(result.maxDegree).toBe(3);
    expect(result.isolatedNodes).toEqual(['ISO']);
    expect(result.healthIssues).toContain('1 个孤立节点');
  });

  it('无根节点时按出度降序回退选择', () => {
    const nodes = [
      baseNode('A', 'Node A', 'core'),
      baseNode('B', 'Node B', 'core'),
    ];
    const edges = [baseEdge('e1', 'A', 'B'), baseEdge('e2', 'A', 'B')];
    const result = analyzeGraph(nodes, edges);
    expect(result.rootNodes).toEqual(['A']);
  });
});

describe('findMissingConnections', () => {
  it('空图返回空建议', () => {
    expect(findMissingConnections([], [])).toEqual([]);
  });

  it('为共享父节点的同级节点生成建议', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'core'),
      baseNode('D', 'Node D', 'leaf'),
    ];
    const edges = [baseEdge('e1', 'A', 'B'), baseEdge('e2', 'A', 'C'), baseEdge('e3', 'B', 'D')];
    const suggestions = findMissingConnections(nodes, edges);
    expect(suggestions).toEqual([
      { sourceId: 'B', targetId: 'C', reason: '同属于 "Node A" 的子节点' },
    ]);
  });

  it('已存在的兄弟连接不会再被建议', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'core'),
    ];
    const edges = [baseEdge('e1', 'A', 'B'), baseEdge('e2', 'A', 'C'), baseEdge('e3', 'B', 'C')];
    expect(findMissingConnections(nodes, edges)).toEqual([]);
  });

  it('受 maxSuggestions 限制', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'core'),
      baseNode('D', 'Node D', 'core'),
    ];
    const edges = [
      baseEdge('e1', 'A', 'B'),
      baseEdge('e2', 'A', 'C'),
      baseEdge('e3', 'A', 'D'),
    ];
    const suggestions = findMissingConnections(nodes, edges, 1);
    expect(suggestions).toHaveLength(1);
  });
});

describe('calculateGlobalMaxDegree 与 calculateGlobalMaxChildren', () => {
  it('空图返回 1', () => {
    expect(calculateGlobalMaxDegree([], [])).toBe(1);
    expect(calculateGlobalMaxChildren([], [])).toBe(1);
  });

  it('正确计算全局最大度与最大子节点数', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'leaf'),
      baseNode('D', 'Node D', 'leaf'),
    ];
    const edges = [baseEdge('e1', 'A', 'B'), baseEdge('e2', 'A', 'C'), baseEdge('e3', 'B', 'D')];
    expect(calculateGlobalMaxDegree(nodes, edges)).toBe(2);
    expect(calculateGlobalMaxChildren(nodes, edges)).toBe(2);
  });
});

describe('calculateNodeImportance', () => {
  it('空图节点基础分数（显式 max 参数）', () => {
    const node = baseNode('A', 'Node A', 'root', '');
    const importance = calculateNodeImportance(node, [node], [], undefined, 1, 1);
    expect(importance).toEqual({
      score: 0.2,
      factors: { degree: 0, childrenCount: 0, level: 1.0, contentLength: 0 },
    });
  });

  it('度与子节点归一化后的分数', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root', ''),
      baseNode('B', 'Node B', 'core', ''),
      baseNode('C', 'Node C', 'leaf', ''),
      baseNode('D', 'Node D', 'leaf', ''),
    ];
    const edges = [baseEdge('e1', 'A', 'B'), baseEdge('e2', 'A', 'C'), baseEdge('e3', 'B', 'D')];
    const b = nodes[1];
    const importance = calculateNodeImportance(b, nodes, edges, undefined, 2, 2);
    expect(importance.factors.degree).toBe(1);
    expect(importance.factors.childrenCount).toBe(0.5);
    expect(importance.factors.level).toBe(0.8);
    expect(importance.factors.contentLength).toBe(0);
    expect(importance.score).toBeCloseTo(0.585);
  });

  it('已掌握节点获得熟练掌握加成', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root', ''),
      baseNode('B', 'Node B', 'core', ''),
    ];
    const edges = [baseEdge('e1', 'A', 'B')];
    const b = nodes[1];
    const without = calculateNodeImportance(b, nodes, edges, undefined, 1, 1);
    const withMastery = calculateNodeImportance(b, nodes, edges, { B: { mastered: true } }, 1, 1);
    expect(withMastery.score).toBeGreaterThan(without.score);
    expect(withMastery.score - without.score).toBeCloseTo(0.01);
  });
});

describe('calculateEdgeStrength', () => {
  it('父子 contains 边', () => {
    const nodes = [
      baseNode('A', 'Node A', 'root'),
      baseNode('B', 'Node B', 'core'),
      baseNode('C', 'Node C', 'leaf'),
      baseNode('D', 'Node D', 'leaf'),
    ];
    const edges = [baseEdge('e1', 'A', 'B'), baseEdge('e2', 'A', 'C'), baseEdge('e3', 'B', 'D')];
    const strength = calculateEdgeStrength(edges[0], nodes, edges);
    expect(strength.factors.relationshipType).toBe('contains');
    expect(strength.factors.commonConnections).toBe(0);
    expect(strength.factors.pathCount).toBeCloseTo(0.2);
    expect(strength.score).toBeCloseTo(0.54);
  });

  it('similar_to 父子边权重低于 contains', () => {
    const nodes = [
      baseNode('X', 'Node X', 'root'),
      baseNode('Y', 'Node Y', 'core'),
      baseNode('Z', 'Node Z', 'core'),
    ];
    const edges = [
      baseEdge('e1', 'X', 'Y'),
      baseEdge('e2', 'X', 'Z'),
      baseEdge('e3', 'Y', 'Z', 'similar_to'),
    ];
    const strength = calculateEdgeStrength(edges[2], nodes, edges);
    expect(strength.factors.relationshipType).toBe('similar_to');
    expect(strength.factors.commonConnections).toBeCloseTo(0.1);
    expect(strength.factors.pathCount).toBeCloseTo(0.4);
    expect(strength.score).toBeCloseTo(0.45);
  });
});