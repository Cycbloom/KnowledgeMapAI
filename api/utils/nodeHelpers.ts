import type { Node, NodeLevel, KnowledgePointVisibility } from '../../src/types';

export interface KnowledgePointData {
  id: string;
  title: string;
  content?: string;
  learning_material?: string;
  properties?: Record<string, any>;
  visibility: KnowledgePointVisibility;
  owner_id: string;
  created_at: string;
  updated_at: string;
}

export interface GraphNodeRaw {
  id: string;
  graph_id: string;
  knowledge_point_id: string;
  x_position: number;
  y_position: number;
  level: NodeLevel;
  is_accepted: boolean;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  knowledge_points?: KnowledgePointData | KnowledgePointData[] | null;
  knowledge_point?: KnowledgePointData | null;
}

function getKnowledgePoint(kp: KnowledgePointData | KnowledgePointData[] | null): KnowledgePointData | null {
  if (!kp) return null;
  if (Array.isArray(kp)) {
    return kp[0] || null;
  }
  return kp;
}

export function buildNodeFromGraphNode(gn: GraphNodeRaw | null): Node | null {
  if (!gn) return null;

  const kp = gn.knowledge_point || getKnowledgePoint(gn.knowledge_points || null);
  return {
    id: kp?.id || gn.knowledge_point_id,
    graph_id: gn.graph_id,
    graph_node_id: gn.id,
    title: kp?.title || '',
    content: kp?.content || '',
    x_position: gn.x_position,
    y_position: gn.y_position,
    level: gn.level,
    properties: kp?.properties || {},
    learning_material: kp?.learning_material || '',
    is_accepted: gn.is_accepted,
    knowledge_point_id: gn.knowledge_point_id,
    visibility: kp?.visibility || 'private',
    owner_id: kp?.owner_id,
    created_at: kp?.created_at || gn.created_at,
    updated_at: kp?.updated_at || gn.updated_at,
    knowledge_point: {
      id: kp?.id || gn.knowledge_point_id,
      title: kp?.title || '',
      content: kp?.content || '',
      learning_material: kp?.learning_material || '',
      properties: kp?.properties || {},
      visibility: kp?.visibility || 'private',
      owner_id: kp?.owner_id || '',
      created_at: kp?.created_at || gn.created_at,
      updated_at: kp?.updated_at || gn.updated_at,
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
