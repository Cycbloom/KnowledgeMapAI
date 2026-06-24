import { SupabaseClient } from "@supabase/supabase-js";
import type { Node } from "@shared/types";
import { logger } from "./logger";
import {
  GRAPH_NODES_SELECT,
  GRAPH_NODES_SELECT_WITH_EMBEDDING,
  GraphNodeRaw,
  getKnowledgePoint,
  buildNodeFromGraphNode,
  buildNodesFromGraphNodes,
} from "../../shared/utils/nodeHelpers";

export {
  GRAPH_NODES_SELECT,
  GRAPH_NODES_SELECT_WITH_EMBEDDING,
  GraphNodeRaw,
  getKnowledgePoint,
  buildNodeFromGraphNode,
  buildNodesFromGraphNodes,
};

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
  supabase: SupabaseClient,
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
    properties?: Record<string, unknown>;
  },
): Promise<{
  knowledge_point_id: string;
  graph_node_id: string;
  id: string;
} | null> {
  // 优先使用 RPC 原子性创建
  const { data: rpcResult, error: rpcError } = await supabase.rpc(
    'create_knowledge_point_with_node',
    {
      p_user_id: userId,
      p_graph_id: data.graph_id,
      p_title: data.title,
      p_content: data.content || '',
      p_x_position: data.x_position || 0,
      p_y_position: data.y_position || 0,
      p_level: data.level || 'normal',
      p_properties: data.properties || {},
    },
  );

  if (!rpcError && rpcResult) {
    const result = rpcResult as { knowledge_point_id: string; graph_node_id: string };

    // RPC 不支持 summary/learning_material，需要补充更新
    if (data.summary || data.learning_material) {
      const updateData: Record<string, string> = {};
      if (data.summary) updateData.summary = data.summary;
      if (data.learning_material) updateData.learning_material = data.learning_material;

      await supabase
        .from('knowledge_points')
        .update(updateData)
        .eq('id', result.knowledge_point_id);
    }

    return {
      knowledge_point_id: result.knowledge_point_id,
      graph_node_id: result.graph_node_id,
      id: result.knowledge_point_id,
    };
  }

  // RPC 失败，降级为分步创建+手动回滚
  logger.warn(
    'create_knowledge_point_with_node RPC failed, falling back to step-by-step creation:',
    rpcError,
  );

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
