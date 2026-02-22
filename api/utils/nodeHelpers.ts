import type { Node, NodeLevel, KnowledgePointVisibility, KnowledgePoint, GraphNode } from '../../src/types';

export type GraphNodeRaw = Omit<GraphNode, 'knowledge_point_id'> & {
  knowledge_point_id: string;
  knowledge_points?: KnowledgePoint | KnowledgePoint[] | null;
  knowledge_point?: KnowledgePoint | null;
};

function getKnowledgePoint(kp: KnowledgePoint | KnowledgePoint[] | null): KnowledgePoint | null {
  if (!kp) return null;
  if (Array.isArray(kp)) {
    return kp[0] || null;
  }
  return kp;
}

/**
 * 将数据库原始图节点数据转换为前端 Node 类型
 * 
 * 重要说明：
 * - Node.id 被设置为 knowledge_point_id，而不是 graph_node 的 id
 * - 这是为了与 Edge 的关联方式兼容（Edge 使用 knowledge_point_id 关联节点）
 * - 如果需要 graph_node 的 id，可以使用 knowledge_point_id 字段（因为一个 knowledge_point 在一个 graph 中只有一个 graph_node）
 */
export function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) return null;

  const kp = gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);
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
    title: kp?.title || '',
    content: kp?.content || '',
    learning_material: kp?.learning_material || '',
    properties: kp?.properties || {},
    visibility: kp?.visibility || 'private',
    owner_id: kp?.owner_id,
    knowledge_point: kp ? {
      id: kp.id,
      title: kp.title,
      content: kp.content,
      learning_material: kp.learning_material,
      properties: kp.properties,
      visibility: kp.visibility,
      owner_id: kp.owner_id,
      created_at: kp.created_at,
      updated_at: kp.updated_at,
    } : {
      id: gn.knowledge_point_id,
      title: '',
      content: '',
      learning_material: '',
      properties: {},
      visibility: 'private' as KnowledgePointVisibility,
      owner_id: '',
      created_at: gn.created_at,
      updated_at: gn.updated_at,
    },
  } as unknown as Node;
}

export function buildNodesFromGraphNodes(graphNodes: GraphNodeRaw[]): Node[] {
  if (!graphNodes || graphNodes.length === 0) return [];
  return graphNodes.map(gn => buildNodeFromGraphNode(gn)).filter((n): n is Node => n !== null);
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

export async function getGraphNodesFromNewTable(supabase: any, graphId: string): Promise<Node[]> {
  const { data: graphNodes, error } = await supabase
    .from('graph_nodes')
    .select(GRAPH_NODES_SELECT)
    .eq('graph_id', graphId)
    .is('deleted_at', null);

  if (error) {
    console.error('getGraphNodesFromNewTable error:', error);
    return [];
  }

  return buildNodesFromGraphNodes(graphNodes || []);
}

export async function getGraphNodesBatchFromNewTable(supabase: any, graphIds: string[]): Promise<Map<string, Node[]>> {
  const result = new Map<string, Node[]>();

  if (!graphIds || graphIds.length === 0) return result;

  const { data: graphNodes, error } = await supabase
    .from('graph_nodes')
    .select(GRAPH_NODES_SELECT)
    .in('graph_id', graphIds)
    .is('deleted_at', null);

  if (error) {
    console.error('getGraphNodesBatchFromNewTable error:', error);
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
    x_position?: number;
    y_position?: number;
    level?: string;
    properties?: any;
  }
): Promise<{ knowledge_point_id: string; graph_node_id: string; id: string } | null> {
  const { data: kp, error: kpError } = await supabase
    .from('knowledge_points')
    .insert({
      title: data.title,
      content: data.content || '',
      properties: data.properties || {},
      visibility: 'private',
      owner_id: userId,
    })
    .select('id')
    .single();

  if (kpError) {
    console.error('createKnowledgePoint error:', kpError);
    return null;
  }

  const { data: gn, error: gnError } = await supabase
    .from('graph_nodes')
    .insert({
      graph_id: data.graph_id,
      knowledge_point_id: kp.id,
      x_position: data.x_position || 0,
      y_position: data.y_position || 0,
      level: data.level || 'normal',
      is_accepted: true,
    })
    .select('id, knowledge_point_id')
    .single();

  if (gnError) {
    console.error('createGraphNode error:', gnError);
    await supabase.from('knowledge_points').delete().eq('id', kp.id);
    return null;
  }

  return {
    knowledge_point_id: kp.id,
    graph_node_id: gn.id,
    id: kp.id,
  };
}

export async function getKnowledgePointsByIds(
  supabase: any,
  knowledgePointIds: string[]
): Promise<Node[]> {
  if (!knowledgePointIds || knowledgePointIds.length === 0) return [];

  const { data: graphNodes, error } = await supabase
    .from('graph_nodes')
    .select(GRAPH_NODES_SELECT)
    .in('knowledge_point_id', knowledgePointIds)
    .is('deleted_at', null);

  if (error) {
    console.error('getKnowledgePointsByIds error:', error);
    return [];
  }

  return buildNodesFromGraphNodes(graphNodes || []);
}
