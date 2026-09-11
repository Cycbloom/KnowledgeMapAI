import { describe, it, expect, vi } from 'vitest';
import { buildExpandRequest, processExpandSuggestions, type ExpandSuggestion } from '../nodeExpansionUtils';
import type { Node, Edge } from '../../../types';

function makeNode(id: string, title: string, content?: string, properties?: Record<string, unknown>): Node {
  return { id, title, content, properties } as Node;
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

describe('processExpandSuggestions', () => {
  function run({
    selectedNode,
    nodes,
    edges,
    suggestions,
  }: {
    selectedNode: Node;
    nodes: Node[];
    edges: Edge[];
    suggestions: ExpandSuggestion[];
  }) {
    const createNode = vi.fn(async (data: Record<string, unknown>) => {
      const newNode = { id: `new-${data.title}`, title: data.title, properties: data.properties } as unknown as Node;
      nodes.push(newNode);
      return newNode;
    });
    const createEdge = vi.fn(async (data: Record<string, unknown>) => {
      return { id: `edge-${data.source_knowledge_point_id}-${data.target_knowledge_point_id}` } as unknown as Edge;
    });
    const onNodeCreated = vi.fn();
    const onEdgeCreated = vi.fn();
    return {
      createNode,
      createEdge,
      onNodeCreated,
      onEdgeCreated,
      resultPromise: processExpandSuggestions({
        selectedNode,
        nodes,
        edges,
        suggestions,
        graphId: 'graph-1',
        createNode,
        createEdge,
        onNodeCreated,
        onEdgeCreated,
      }),
    };
  }

  it('specific 建议命中图内同名节点时复用（只连边不新建）', async () => {
    const selectedNode = makeNode('parent', '项目A');
    const existing = makeNode('existing', 'React 虚拟 DOM');
    const { resultPromise, createNode, createEdge, onEdgeCreated } = run({
      selectedNode,
      nodes: [selectedNode, existing],
      edges: [],
      suggestions: [{ title: 'React 虚拟 DOM', specificity: 'specific' }],
    });
    const result = await resultPromise;

    expect(createNode).not.toHaveBeenCalled();
    expect(createEdge).toHaveBeenCalledTimes(1);
    expect(createEdge.mock.calls[0][0]).toMatchObject({
      source_knowledge_point_id: 'parent',
      target_knowledge_point_id: 'existing',
    });
    expect(onEdgeCreated).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ newNodesCount: 0, newEdgesCount: 1 });
  });

  it('generic 建议即使图内有同名节点也新建（防误合并）', async () => {
    const selectedNode = makeNode('parent', '项目B');
    const existing = makeNode('existing', '未来展望');
    const { resultPromise, createNode, createEdge } = run({
      selectedNode,
      nodes: [selectedNode, existing],
      edges: [],
      suggestions: [{ title: '未来展望', specificity: 'generic' }],
    });
    const result = await resultPromise;

    expect(createNode).toHaveBeenCalledTimes(1);
    expect(createNode.mock.calls[0][0].properties).toEqual({ specificity: 'generic' });
    expect(createEdge).toHaveBeenCalledTimes(1);
    // 新建的边指向新节点而非已存在的「未来展望」
    expect(createEdge.mock.calls[0][0].target_knowledge_point_id).toBe('new-未来展望');
    expect(result).toEqual({ newNodesCount: 1, newEdgesCount: 1 });
  });

  it('specific 建议命中图内 generic 节点时同样新建（不参与复用）', async () => {
    const selectedNode = makeNode('parent', '项目C');
    const existing = makeNode('existing', '未来展望', undefined, { specificity: 'generic' });
    const { resultPromise, createNode, createEdge } = run({
      selectedNode,
      nodes: [selectedNode, existing],
      edges: [],
      suggestions: [{ title: '未来展望', specificity: 'specific' }],
    });
    const result = await resultPromise;

    expect(createNode).toHaveBeenCalledTimes(1);
    expect(createEdge).toHaveBeenCalledTimes(1);
    expect(createEdge.mock.calls[0][0].target_knowledge_point_id).toBe('new-未来展望');
    expect(result).toEqual({ newNodesCount: 1, newEdgesCount: 1 });
  });

  it('标题归一化匹配：大小写/空格差异仍可复用', async () => {
    const selectedNode = makeNode('parent', '项目D');
    const existing = makeNode('existing', ' 未来展望 ');
    const { resultPromise, createNode } = run({
      selectedNode,
      nodes: [selectedNode, existing],
      edges: [],
      suggestions: [{ title: '未来展望', specificity: 'specific' }],
    });
    await resultPromise;

    expect(createNode).not.toHaveBeenCalled();
  });

  it('同名且边已存在时不重复连边', async () => {
    const selectedNode = makeNode('parent', '项目E');
    const existing = makeNode('existing', 'TCP 三次握手');
    const { resultPromise, createEdge } = run({
      selectedNode,
      nodes: [selectedNode, existing],
      edges: [makeEdge('parent', 'existing')],
      suggestions: [{ title: 'TCP 三次握手', specificity: 'specific' }],
    });
    const result = await resultPromise;

    expect(createEdge).not.toHaveBeenCalled();
    expect(result).toEqual({ newNodesCount: 0, newEdgesCount: 0 });
  });
});
