import { Node, Edge } from '../../types';
import type { NodeSpecificity } from '@shared/types';
import { canReuseNode } from '@shared/utils/nodeSpecificity';
import { getLevel, getNextLevel, getLevelColorHex } from '../../utils/graph/graphUtils';
import { logger } from '../../utils/logger';

export interface ExpandSuggestion {
  title: string;
  content?: string;
  /** 特异性标注：specific=精确专名，generic=泛化名称（不参与复用判定，避免误合并） */
  specificity?: NodeSpecificity;
}

export interface ExpandNodeParams {
  selectedNode: Node;
  nodes: Node[];
  edges: Edge[];
  suggestions: ExpandSuggestion[];
  graphId: string;
  createNode: (data: {
    graph_id: string;
    title: string;
    content?: string;
    x_position: number;
    y_position: number;
    color: string;
    level: string;
    properties: Record<string, unknown>;
  }) => Promise<Node>;
  createEdge: (data: {
    source_knowledge_point_id: string;
    target_knowledge_point_id: string;
    relationship_type: string;
    graphId: string;
  }) => Promise<Edge>;
  onNodeCreated?: (node: Node) => void;
  onEdgeCreated?: (edge: Edge) => void;
}

export interface ExpandNodeResult {
  newNodesCount: number;
  newEdgesCount: number;
}

export async function processExpandSuggestions({
  selectedNode,
  nodes,
  edges,
  suggestions,
  graphId,
  createNode,
  createEdge,
  onNodeCreated,
  onEdgeCreated
}: ExpandNodeParams): Promise<ExpandNodeResult> {
  const parentLevel = getLevel(selectedNode, edges);
  const newLevel = getNextLevel(parentLevel);
  
  let newNodesCount = 0;
  let newEdgesCount = 0;

  // 标题归一化：trim + 小写，避免「未来展望 」与「未来展望」等细微差异导致同义节点漏匹配
  const normalizeTitle = (title: string) => title.trim().toLowerCase();

  // 预处理：将 title->首节点、无向边偶对分别索引为 O(1) 查找，
  // 避免在 suggestions 循环内对 nodes/edges 做线性扫描（原为 O(suggestions*(n+m))）
  const nodesByTitle = new Map<string, Node>();
  for (const n of nodes) {
    const key = normalizeTitle(n.title);
    if (!nodesByTitle.has(key)) {
      nodesByTitle.set(key, n);
    }
  }
  const connectedEdgePairs = new Set<string>();
  for (const e of edges) {
    const a = e.source_knowledge_point_id;
    const b = e.target_knowledge_point_id;
    connectedEdgePairs.add(`${a}|${b}`);
    connectedEdgePairs.add(`${b}|${a}`);
  }

  // 复用判定：泛化名称（generic）一律不参与，避免「项目现状」「未来展望」等
  // 跨上下文语义不同的同名节点被误合并。判定逻辑与后端共用 shared canReuseNode。
  for (const s of suggestions) {
    const existingNode = nodesByTitle.get(normalizeTitle(s.title));
    const canReuse =
      !!existingNode &&
      existingNode.id !== selectedNode.id &&
      canReuseNode(
        s.specificity,
        existingNode.properties?.specificity as NodeSpecificity | undefined,
      );

    if (canReuse) {
      const edgeExists = connectedEdgePairs.has(`${selectedNode.id}|${existingNode.id}`);

      if (!edgeExists) {
        const newEdge = await createEdge({
          source_knowledge_point_id: selectedNode.id,
          target_knowledge_point_id: existingNode.id,
          relationship_type: 'contains',
          graphId
        });
        onEdgeCreated?.(newEdge);
        newEdgesCount++;
      }
    } else {
      const angle = Math.random() * Math.PI * 2;
      const radius = 4 + Math.random() * 4;
      const x = Math.round(selectedNode.x_position + Math.cos(angle) * radius);
      const y = Math.round(selectedNode.y_position + Math.sin(angle) * radius);
      
      const newNode = await createNode({
        graph_id: graphId,
        title: s.title,
        content: s.content,
        x_position: x,
        y_position: y,
        color: getLevelColorHex(newLevel),
        level: newLevel,
        properties: s.specificity ? { specificity: s.specificity } : {}
      });
      
      if (!newNode) {
        logger.warn(`Failed to create node: ${s.title}`);
        continue;
      }
      
      onNodeCreated?.(newNode);

      const newEdge = await createEdge({
        source_knowledge_point_id: selectedNode.id,
        target_knowledge_point_id: newNode.id,
        relationship_type: 'contains',
        graphId
      });
      onEdgeCreated?.(newEdge);
      newNodesCount++;
      newEdgesCount++;
    }
  }

  return { newNodesCount, newEdgesCount };
}

export function getExistingTitles(nodes: Node[]): string[] {
  // 单趟收集非空标题，替代 map+filter 两次扫描
  const titles: string[] = [];
  for (const n of nodes) {
    if (n.title) titles.push(n.title);
  }
  return titles;
}

export function getCurrentChildrenTitles(
  selectedNodeId: string,
  nodes: Node[],
  edges: Edge[]
): string[] {
  // 单趟收集子节点 ID 集合，替代 filter+map 的两次扫描
  const childrenIds = new Set<string>();
  for (const e of edges) {
    if (e.source_knowledge_point_id === selectedNodeId) {
      childrenIds.add(e.target_knowledge_point_id);
    }
  }

  // 用 Set 查找替代 childrenIds.includes 的线性扫描，并合并 map+filter
  const titles: string[] = [];
  for (const n of nodes) {
    if (childrenIds.has(n.id) && n.title) titles.push(n.title);
  }
  return titles;
}

export function buildDefaultExpandPrompt(nodeTitle: string): string {
  return `请为 ${nodeTitle} 生成 3-5 个相关的子主题，每个子主题应该简洁明确`;
}

export interface BuildExpandRequestParams {
  selectedNode: Node;
  nodes: Node[];
  edges: Edge[];
  /** 用户自定义展开提示词；为空时使用默认提示词 */
  prompt?: string;
  graphId?: string;
}

/**
 * 组装 AI 展开请求：统一计算 parentLevel / existingTitles / currentChildrenTitles /
 * expandPrompt，避免 useGraphAIOperations 与 useCombinedGraphAIOperations 重复实现。
 */
export function buildExpandRequest({
  selectedNode,
  nodes,
  edges,
  prompt,
  graphId,
}: BuildExpandRequestParams): {
  node_title: string;
  node_content: string | undefined;
  node_level: string;
  existing_titles: string[];
  current_children: string[];
  expand_prompt: string;
  graph_id?: string;
} {
  const parentLevel = getLevel(selectedNode, edges);

  const existingTitles = getExistingTitles(nodes);
  const currentChildrenTitles = getCurrentChildrenTitles(selectedNode.id, nodes, edges);

  const expandPrompt = prompt || buildDefaultExpandPrompt(selectedNode.title);

  return {
    node_title: selectedNode.title,
    node_content: selectedNode.content,
    node_level: parentLevel,
    existing_titles: existingTitles,
    current_children: currentChildrenTitles,
    expand_prompt: expandPrompt,
    ...(graphId ? { graph_id: graphId } : {}),
  };
}
