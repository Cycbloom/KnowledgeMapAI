import { Node, Edge } from '../../types';
import { getLevel, getNextLevel, getLevelColorHex } from '../../lib/graphUtils';

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

  for (const s of suggestions) {
    const existingNode = nodes.find(n => n.title === s.title);
    
    if (existingNode) {
      const edgeExists = edges.some(e =>
        (e.source_knowledge_point_id === selectedNode.id && e.target_knowledge_point_id === existingNode.id) ||
        (e.source_knowledge_point_id === existingNode.id && e.target_knowledge_point_id === selectedNode.id)
      );
      
      if (!edgeExists && existingNode.id !== selectedNode.id) {
        const newEdge = await createEdge({
          source_knowledge_point_id: selectedNode.id,
          target_knowledge_point_id: existingNode.id,
          relationship_type: 'related',
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
      
      onNodeCreated?.(newNode);

      const newEdge = await createEdge({
        source_knowledge_point_id: selectedNode.id,
        target_knowledge_point_id: newNode.id,
        relationship_type: 'related',
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
  return nodes.map(n => n.title).filter(Boolean) as string[];
}

export function getCurrentChildrenTitles(
  selectedNodeId: string,
  nodes: Node[],
  edges: Edge[]
): string[] {
  const childrenIds = edges
    .filter(e => e.source_knowledge_point_id === selectedNodeId)
    .map(e => e.target_knowledge_point_id);
  
  return nodes
    .filter(n => childrenIds.includes(n.id))
    .map(n => n.title)
    .filter(Boolean) as string[];
}

export function buildDefaultExpandPrompt(nodeTitle: string): string {
  return `请为 ${nodeTitle} 生成 3-5 个相关的子主题，每个子主题应该简洁明确`;
}
