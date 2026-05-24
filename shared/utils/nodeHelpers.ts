import type { Node, KnowledgePoint, GraphNode } from "@shared/types/graph";

export type GraphNodeRaw = Omit<GraphNode, "knowledge_point_id"> & {
  knowledge_point_id: string;
  knowledge_points?: KnowledgePoint | KnowledgePoint[] | null;
  knowledge_point?: KnowledgePoint | null;
};

export const GRAPH_NODES_SELECT = `
  id,
  graph_id,
  knowledge_point_id,
  x_position,
  y_position,
  level,
  is_accepted,
  created_at,
  updated_at,
  knowledge_points (
    id,
    title,
    content,
    learning_material,
    properties,
    visibility,
    owner_id,
    created_at,
    updated_at,
    keywords
  )
`;

export function getKnowledgePoint(
  kp: KnowledgePoint | KnowledgePoint[] | null,
): KnowledgePoint | null {
  if (!kp) return null;
  if (Array.isArray(kp)) {
    return kp[0] || null;
  }
  return kp;
}

export function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) return null;

  const kp =
    gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);

  if (!kp) return null;

  return {
    id: gn.knowledge_point_id,
    graph_id: gn.graph_id,
    knowledge_point_id: gn.knowledge_point_id,
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    is_accepted: gn.is_accepted,
    deleted_at: gn.deleted_at,
    created_at: gn.created_at,
    updated_at: gn.updated_at,
    title: kp.title || "",
    content: kp.content || "",
    learning_material: kp.learning_material || "",
    keywords: kp.keywords || [],
    properties: kp.properties || {},
    visibility: kp.visibility || "private",
    owner_id: kp.owner_id || "",
    embedding: kp.embedding,
  } as Node;
}

export function buildNodesFromGraphNodes(graphNodes: GraphNodeRaw[]): Node[] {
  if (!graphNodes || graphNodes.length === 0) return [];
  return graphNodes
    .map((gn) => buildNodeFromGraphNode(gn))
    .filter((n): n is Node => n !== null);
}