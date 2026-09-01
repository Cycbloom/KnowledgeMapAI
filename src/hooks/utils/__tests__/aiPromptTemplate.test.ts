import { describe, it, expect } from 'vitest';
import { renderAiPromptTemplate } from '../aiPromptTemplate';
import type { Node, Edge } from '../../../types';

function makeNode(id: string, title: string, content?: string): Node {
  return { id, title, content } as Node;
}

function makeEdge(source: string, target: string): Edge {
  return { source_knowledge_point_id: source, target_knowledge_point_id: target } as Edge;
}

describe('renderAiPromptTemplate', () => {
  it('替换 {主题} 为选中节点标题', () => {
    const nodes = [makeNode('n1', '量子计算')];
    const rendered = renderAiPromptTemplate('请解释 {主题}', makeNode('n1', '量子计算'), nodes, []);
    expect(rendered).toBe('请解释 量子计算');
  });

  it('替换 {父节点内容}：通过入边找到父节点并用其 content 填充', () => {
    const nodes = [
      makeNode('parent', '计算机科学', '计算机科学的定义'),
      makeNode('child', '量子计算', '量子计算的内容'),
    ];
    const edges = [makeEdge('parent', 'child')];
    const rendered = renderAiPromptTemplate(
      '父节点内容：{父节点内容}',
      makeNode('child', '量子计算', '量子计算的内容'),
      nodes,
      edges,
    );
    expect(rendered).toBe('父节点内容：计算机科学的定义');
  });

  it('无父节点时保留 {父节点内容} 占位符原文', () => {
    const nodes = [makeNode('root', '根主题')];
    const rendered = renderAiPromptTemplate(
      '父节点内容：{父节点内容}',
      makeNode('root', '根主题'),
      nodes,
      [],
    );
    expect(rendered).toBe('父节点内容：{父节点内容}');
  });

  it('替换 {兄弟节点内容}：父节点的其他子节点以列表形式填充', () => {
    const nodes = [
      makeNode('parent', '计算机科学'),
      makeNode('child', '量子计算', '量子计算的内容'),
      makeNode('sibling', '算法', '算法的内容'),
    ];
    const edges = [makeEdge('parent', 'child'), makeEdge('parent', 'sibling')];
    const rendered = renderAiPromptTemplate(
      '兄弟节点：{兄弟节点内容}',
      makeNode('child', '量子计算', '量子计算的内容'),
      nodes,
      edges,
    );
    expect(rendered).toContain('兄弟节点：- 算法: 算法的内容');
    expect(rendered).not.toContain('量子计算');
  });

  it('无兄弟节点时保留 {兄弟节点内容} 占位符原文', () => {
    const nodes = [makeNode('child', '量子计算')];
    const rendered = renderAiPromptTemplate(
      '兄弟节点：{兄弟节点内容}',
      makeNode('child', '量子计算'),
      nodes,
      [],
    );
    expect(rendered).toBe('兄弟节点：{兄弟节点内容}');
  });

  it('selectedNode 为空时原样返回 prompt', () => {
    const rendered = renderAiPromptTemplate('请解释 {主题}', null, [], []);
    expect(rendered).toBe('请解释 {主题}');
  });
});
