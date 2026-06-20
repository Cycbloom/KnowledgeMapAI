import { SupabaseClient } from "@supabase/supabase-js";
import type { Node, KnowledgePoint, GraphNode } from "@shared/types";
import { logger } from "./logger";
import { GRAPH_NODES_SELECT, GRAPH_NODES_SELECT_WITH_EMBEDDING } from "../../shared/utils/nodeHelpers";

export { GRAPH_NODES_SELECT, GRAPH_NODES_SELECT_WITH_EMBEDDING };

export type GraphNodeRaw = Omit<GraphNode, "knowledge_point_id"> & {
  knowledge_point_id: string;
  knowledge_points?: KnowledgePoint | KnowledgePoint[] | null;
  knowledge_point?: KnowledgePoint | null;
};

function getKnowledgePoint(
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
    summary: kp.summary || "",
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

export async function getGraphNodesFromNewTable(
  supabase: SupabaseClient,
  graphId: string,
): Promise<Node[]> {
  const { data: graphNodes, error } = await supabase
    .from("graph_nodes")
    .select(GRAPH_NODES_SELECT)
    .eq("graph_id", graphId)
    .is("deleted_at", null);

  if (error) {
    logger.error("getGraphNodesFromNewTable error:", error);
    return [];
  }

  return buildNodesFromGraphNodes(graphNodes || []);
}

export async function getGraphNodesBatchFromNewTable(
  supabase: any,
  graphIds: string[],
): Promise<Map<string, Node[]>> {
  const result = new Map<string, Node[]>();

  if (!graphIds || graphIds.length === 0) return result;

  const { data: graphNodes, error } = await supabase
    .from("graph_nodes")
    .select(GRAPH_NODES_SELECT)
    .in("graph_id", graphIds)
    .is("deleted_at", null);

  if (error) {
    logger.error("getGraphNodesBatchFromNewTable error:", error);
    return result;
  }

  (graphNodes || []).forEach((gn: GraphNodeRaw) => {
    const gid = gn.graph_id;
    if (!result.has(gid)) {
      result.set(gid, []);
    }
    const node = buildNodeFromGraphNode(gn);
    if (node) {
      result.get(gid)!.push(node);
    }
  });

  return result;
}

export async function createKnowledgePointWithGraphNode(
  supabase: any,
  userId: string,
  data: {
    graph_id: string;
    title: string;
    content?: string;
    summary?: string;
    learning_material?: string;
    x_position?: number;
    y_position?: number;
    level?: string;
    properties?: any;
  },
): Promise<{
  knowledge_point_id: string;
  graph_node_id: string;
  id: string;
} | null> {
  const { data: kp, error: kpError } = await supabase
    .from("knowledge_points")
    .insert({
      title: data.title,
      content: data.content || "",
      summary: data.summary || null,
      learning_material: data.learning_material || null,
      properties: data.properties || {},
      visibility: "private",
      owner_id: userId,
    })
    .select("id")
    .single();

  if (kpError) {
    logger.error("createKnowledgePoint error:", kpError);
    return null;
  }

  const { data: gn, error: gnError } = await supabase
    .from("graph_nodes")
    .insert({
      graph_id: data.graph_id,
      knowledge_point_id: kp.id,
      x_position: data.x_position || 0,
      y_position: data.y_position || 0,
      level: data.level || "normal",
      is_accepted: true,
    })
    .select("id, knowledge_point_id")
    .single();

  if (gnError) {
    logger.error("createGraphNode error:", gnError);
    await supabase.from("knowledge_points").delete().eq("id", kp.id);
    return null;
  }

  return {
    knowledge_point_id: kp.id,
    graph_node_id: gn.id,
    id: kp.id,
  };
}

export async function getKnowledgePointsByIds(
  supabase: SupabaseClient,
  knowledgePointIds: string[],
): Promise<Node[]> {
  if (!knowledgePointIds || knowledgePointIds.length === 0) return [];

  const { data: graphNodes, error } = await supabase
    .from("graph_nodes")
    .select(GRAPH_NODES_SELECT)
    .in("knowledge_point_id", knowledgePointIds)
    .is("deleted_at", null);

  if (error) {
    logger.error("getKnowledgePointsByIds error:", error);
    return [];
  }

  return buildNodesFromGraphNodes(graphNodes || []);
}
