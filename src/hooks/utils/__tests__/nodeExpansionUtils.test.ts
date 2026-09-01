import { describe, it, expect } from 'vitest';
import { buildExpandRequest } from '../nodeExpansionUtils';
import type { Node, Edge } from '../../../types';

function makeNode(id: string, title: string, content?: string): Node {
  return { id, title, content } as Node;
}

function makeEdge(source: string, target: string): Edge {
  return { source_knowledge_point_id: source, target_knowledge_point_id: target } as Edge;
}

describe('buildExpandRequest', () => {
  it('组装 node_title / node_content / node_level / expand_prompt', () => {
    const selectedNode = makeNode('child', '量子计算', '量子计算的内容');
    const nodes = [makeNode('parent', '计算机科学'), selectedNode];
    const edges = [makeEdge('parent', 'child')];

    const req = buildExpandRequest({ selectedNode, nodes, edges });

    expect(req.node_title).toBe('量子计算');
    expect(req.node_content).toBe('量子计算的内容');
    // parent 无入边 → root 级（getLevel 默认最低级），node_level 存在即可
    expect(typeof req.node_level).toBe('string');
    expect(req.existing_titles).toContain('计算机科学');
    expect(req.existing_titles).toContain('量子计算');
    // 无自定义 prompt → 使用默认展开提示词
    expect(req.expand_prompt).toContain('量子计算');
    expect(req.expand_prompt).toContain('子主题');
    expect(req.graph_id).toBeUndefined();
  });

  it('current_children 仅含选中节点的直接子节点', () => {
    const selectedNode = makeNode('parent', '计算机科学');
    const child1 = makeNode('c1', '算法');
    const child2 = makeNode('c2', '数据结构');
    const unrelated = makeNode('u1', '其他');
    const nodes = [selectedNode, child1, child2, unrelated];
    const edges = [
      makeEdge('parent', 'c1'),
      makeEdge('parent', 'c2'),
      makeEdge('c1', 'u1'), // unrelated 是 child 的子节点，非直接子
    ];

    const req = buildExpandRequest({ selectedNode, nodes, edges });

    expect(req.current_children).toEqual(expect.arrayContaining(['算法', '数据结构']));
    expect(req.current_children).not.toContain('其他');
  });

  it('自定义 prompt 优先于默认提示词', () => {
    const selectedNode = makeNode('n1', '主题');
    const req = buildExpandRequest({
      selectedNode,
      nodes: [selectedNode],
      edges: [],
      prompt: '自定义提示词',
    });
    expect(req.expand_prompt).toBe('自定义提示词');
  });

  it('传入 graphId 时附带 graph_id 字段', () => {
    const selectedNode = makeNode('n1', '主题');
    const req = buildExpandRequest({
      selectedNode,
      nodes: [selectedNode],
      edges: [],
      graphId: 'graph-1',
    });
    expect(req.graph_id).toBe('graph-1');
  });
});
