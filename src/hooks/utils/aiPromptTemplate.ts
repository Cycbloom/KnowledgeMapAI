import type { Node, Edge } from '../../types';

/**
 * 渲染 AI 生成内容的节点级 prompt 模板。
 *
 * 支持的占位符：
 * - {主题} → 选中节点标题
 * - {父节点内容} → 选中节点父节点的 content/title（无父节点则保留原文）
 * - {兄弟节点内容} → 选中节点兄弟节点列表（无兄弟则保留原文）
 *
 * 抽取自 useGraphAIOperations / useContentGeneration 的重复实现，
 * 通过预构建节点与入边索引将嵌套 find 的 O(n*m) 扫描降为 O(1) 查找。
 */
export function renderAiPromptTemplate(
  prompt: string,
  selectedNode: Node | null,
  nodes: Node[],
  edges: Edge[],
): string {
  if (!selectedNode) return prompt;

  let rendered = prompt.replace(/{主题}/g, selectedNode.title || '');

  const nodeById = new Map<string, Node>(nodes.map((n) => [n.id, n]));
  const edgeByTarget = new Map<string, Edge>();
  for (const e of edges) {
    if (!edgeByTarget.has(e.target_knowledge_point_id)) {
      edgeByTarget.set(e.target_knowledge_point_id, e);
    }
  }

  const parentEdge = edgeByTarget.get(selectedNode.id);
  const parentNode = parentEdge
    ? nodeById.get(parentEdge.source_knowledge_point_id)
    : undefined;

  if (parentNode) {
    rendered = rendered.replace(
      /{父节点内容}/g,
      parentNode.content || parentNode.title || '',
    );
  }

  // 单趟构建父节点的子节点 id Set，将 filter+some 的 O(n*m) 降为 O(n+m)
  const childIdSet = new Set<string>();
  if (parentNode) {
    for (const e of edges) {
      if (e.source_knowledge_point_id === parentNode.id) {
        childIdSet.add(e.target_knowledge_point_id);
      }
    }
  }

  const siblingNodes = nodes.filter(
    (n) => n.id !== selectedNode.id && childIdSet.has(n.id),
  );
  if (siblingNodes.length > 0) {
    const siblingContent = siblingNodes
      .map((n) => `- ${n.title}: ${n.content || ''}`)
      .join('\n');
    rendered = rendered.replace(/{兄弟节点内容}/g, siblingContent);
  }

  return rendered;
}
