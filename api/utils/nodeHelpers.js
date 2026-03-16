import { logger } from "./logger.js";
function getKnowledgePoint(kp) {
    if (!kp)
        return null;
    if (Array.isArray(kp)) {
        return kp[0] || null;
    }
    return kp;
}
/**
 * 将数据库原始图节点数据转换为前端 Node 类型
 *
 * 扁平化设计：直接合并 GraphNode 和 KnowledgePoint 的所有字段
 */
export function buildNodeFromGraphNode(gn) {
    if (!gn)
        return null;
    const kp = gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);
    if (!kp)
        return null;
    return {
        // GraphNode 字段
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
        // KnowledgePoint 字段（扁平化）
        title: kp.title || "",
        content: kp.content || "",
        learning_material: kp.learning_material || "",
        properties: kp.properties || {},
        visibility: kp.visibility || "private",
        owner_id: kp.owner_id || "",
        embedding: kp.embedding,
    };
}
export function buildNodesFromGraphNodes(graphNodes) {
    if (!graphNodes || graphNodes.length === 0)
        return [];
    return graphNodes
        .map((gn) => buildNodeFromGraphNode(gn))
        .filter((n) => n !== null);
}
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
    updated_at
  )
`;
export async function getGraphNodesFromNewTable(supabase, graphId) {
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
export async function getGraphNodesBatchFromNewTable(supabase, graphIds) {
    const result = new Map();
    if (!graphIds || graphIds.length === 0)
        return result;
    const { data: graphNodes, error } = await supabase
        .from("graph_nodes")
        .select(GRAPH_NODES_SELECT)
        .in("graph_id", graphIds)
        .is("deleted_at", null);
    if (error) {
        console.error("getGraphNodesBatchFromNewTable error:", error);
        return result;
    }
    (graphNodes || []).forEach((gn) => {
        const gid = gn.graph_id;
        if (!result.has(gid)) {
            result.set(gid, []);
        }
        const node = buildNodeFromGraphNode(gn);
        if (node) {
            result.get(gid).push(node);
        }
    });
    return result;
}
export async function createKnowledgePointWithGraphNode(supabase, userId, data) {
    const { data: kp, error: kpError } = await supabase
        .from("knowledge_points")
        .insert({
        title: data.title,
        content: data.content || "",
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
        console.error("createGraphNode error:", gnError);
        await supabase.from("knowledge_points").delete().eq("id", kp.id);
        return null;
    }
    return {
        knowledge_point_id: kp.id,
        graph_node_id: gn.id,
        id: kp.id,
    };
}
export async function getKnowledgePointsByIds(supabase, knowledgePointIds) {
    if (!knowledgePointIds || knowledgePointIds.length === 0)
        return [];
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
//# sourceMappingURL=nodeHelpers.js.map