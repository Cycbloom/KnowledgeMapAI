import { Node, Edge } from '../../types';
import { getLevel, getNextLevel, getLevelColorHex } from '../../utils/graph/graphUtils';
import { logger } from '../../utils/logger';

export interface ExpandSuggestion {
  title: string;
  content?: string;
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

  // 预处理：将 title->首节点、无向边偶对分别索引为 O(1) 查找，
  // 避免在 suggestions 循环内对 nodes/edges 做线性扫描（原为 O(suggestions*(n+m))）
  const nodesByTitle = new Map<string, Node>();
  for (const n of nodes) {
    if (!nodesByTitle.has(n.title)) {
      nodesByTitle.set(n.title, n);
    }
  }
  const connectedEdgePairs = new Set<string>();
  for (const e of edges) {
    const a = e.source_knowledge_point_id;
    const b = e.target_knowledge_point_id;
    connectedEdgePairs.add(`${a}|${b}`);
    connectedEdgePairs.add(`${b}|${a}`);
  }

  for (const s of suggestions) {
    const existingNode = nodesByTitle.get(s.title);
    
    if (existingNode) {
      const edgeExists = connectedEdgePairs.has(`${selectedNode.id}|${existingNode.id}`);
      
      if (!edgeExists && existingNode.id !== selectedNode.id) {
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
        properties: {}
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
