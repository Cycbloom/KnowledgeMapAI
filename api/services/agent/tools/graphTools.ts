import type { AgentTool, ToolContext } from '../types';

export const getGraphOverviewTool: AgentTool = {
  name: 'get_graph_overview',
  description: '获取用户知识图谱的整体概览，包括图谱数量、节点总数、关系总数等统计信息',
  parameters: {
    type: 'object',
    properties: {
      graphIds: {
        type: 'array',
        items: { type: 'string' },
        description: '要查询的图谱ID列表，为空则查询所有图谱',
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphIds = params.graphIds as string[] | undefined;
    
    let query = supabase
      .from('knowledge_graphs')
      .select('id, title, description, created_at', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (graphIds && graphIds.length > 0) {
      query = query.in('id', graphIds);
    }
    
    const { data: graphs, error, count } = await query;
    
    if (error) {
      throw new Error(`Failed to get graph overview: ${error.message}`);
    }
    
    const graphIdList = graphs?.map(g => g.id) || [];
    
    const { count: nodeCount, error: nodeError } = await supabase
      .from('graph_nodes')
      .select('id', { count: 'exact', head: true })
      .in('graph_id', graphIdList);
    
    if (nodeError) {
      throw new Error(`Failed to get node count: ${nodeError.message}`);
    }
    
    const { count: edgeCount, error: edgeError } = await supabase
      .from('edges')
      .select('id', { count: 'exact', head: true })
      .in('graph_id', graphIdList);
    
    if (edgeError) {
      throw new Error(`Failed to get edge count: ${edgeError.message}`);
    }
    
    return {
      graphCount: count || 0,
      nodeCount: nodeCount || 0,
      edgeCount: edgeCount || 0,
      graphs: graphs || [],
    };
  },
};

export const getGraphRelationsTool: AgentTool = {
  name: 'get_graph_relations',
  description: '获取图谱之间的关系信息，包括图谱间的连接和依赖',
  parameters: {
    type: 'object',
    properties: {
      graphIds: {
        type: 'array',
        items: { type: 'string' },
        description: '要查询的图谱ID列表',
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphIds = params.graphIds as string[] | undefined;
    
    const { data: userGraphs, error: graphsError } = await supabase
      .from('knowledge_graphs')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (graphsError) {
      throw new Error(`Failed to get user graphs: ${graphsError.message}`);
    }
    
    const userGraphIds = (userGraphs || []).map(g => g.id);
    
    if (userGraphIds.length === 0) {
      return {
        relations: [],
        totalRelations: 0,
      };
    }
    
    const { data: relations, error } = await supabase
      .from('graph_relations')
      .select(`
        id,
        source_graph_id,
        target_graph_id,
        relation_type,
        context,
        created_at
      `)
      .or(`source_graph_id.in.(${userGraphIds.join(',')}),target_graph_id.in.(${userGraphIds.join(',')})`);
    
    if (error) {
      throw new Error(`Failed to get graph relations: ${error.message}`);
    }
    
    let filteredRelations = relations || [];
    if (graphIds && graphIds.length > 0) {
      filteredRelations = filteredRelations.filter(
        r => graphIds.includes(r.source_graph_id) || graphIds.includes(r.target_graph_id)
      );
    }
    
    return {
      relations: filteredRelations,
      totalRelations: filteredRelations.length,
    };
  },
};

export const getIsolatedGraphsTool: AgentTool = {
  name: 'get_isolated_graphs',
  description: '获取所有孤立的知识图谱（没有与其他图谱建立关系的图谱）',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    
    const { data: graphs, error: graphsError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description, created_at')
      .eq('user_id', userId)
      .is('deleted_at', null);
    
    if (graphsError) {
      throw new Error(`Failed to get graphs: ${graphsError.message}`);
    }
    
    const graphIds = (graphs || []).map(g => g.id);
    
    if (graphIds.length === 0) {
      return {
        isolatedGraphs: [],
        totalIsolated: 0,
        totalConnected: 0,
      };
    }
    
    const { data: relations, error: relationsError } = await supabase
      .from('graph_relations')
      .select('source_graph_id, target_graph_id')
      .or(`source_graph_id.in.(${graphIds.join(',')}),target_graph_id.in.(${graphIds.join(',')})`);
    
    if (relationsError) {
      throw new Error(`Failed to get relations: ${relationsError.message}`);
    }
    
    const connectedGraphIds = new Set<string>();
    (relations || []).forEach(r => {
      connectedGraphIds.add(r.source_graph_id);
      connectedGraphIds.add(r.target_graph_id);
    });
    
    const isolatedGraphs = (graphs || []).filter(g => !connectedGraphIds.has(g.id));
    
    return {
      isolatedGraphs,
      totalIsolated: isolatedGraphs.length,
      totalConnected: connectedGraphIds.size,
    };
  },
};

export const getGraphDetailsTool: AgentTool = {
  name: 'get_graph_details',
  description: '获取指定图谱的详细信息，包括节点和边',
  parameters: {
    type: 'object',
    properties: {
      graphId: {
        type: 'string',
        description: '图谱ID',
      },
    },
    required: ['graphId'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graphId as string;
    
    const { data: graph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description, created_at, updated_at')
      .eq('id', graphId)
      .eq('user_id', userId)
      .single();
    
    if (graphError) {
      throw new Error(`Failed to get graph: ${graphError.message}`);
    }
    
    if (!graph) {
      throw new Error('Graph not found');
    }
    
    const { data: nodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select(`
        id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `)
      .eq('graph_id', graphId);
    
    if (nodesError) {
      throw new Error(`Failed to get nodes: ${nodesError.message}`);
    }
    
    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('id, source_knowledge_point_id, target_knowledge_point_id, relationship_type')
      .eq('graph_id', graphId);
    
    if (edgesError) {
      throw new Error(`Failed to get edges: ${edgesError.message}`);
    }
    
    const formattedNodes = (nodes || []).map(n => {
      const kp = n.knowledge_points as unknown as { id: string; title: string; content: string } | { id: string; title: string; content: string }[] | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      return {
        id: kpData?.id || n.id,
        title: kpData?.title || '',
        content: kpData?.content || '',
        level: n.level,
      };
    });
    
    return {
      graph,
      nodes: formattedNodes,
      edges: (edges || []).map(e => ({
        id: e.id,
        source_id: e.source_knowledge_point_id,
        target_id: e.target_knowledge_point_id,
        relationship: e.relationship_type,
      })),
      nodeCount: formattedNodes.length,
      edgeCount: edges?.length || 0,
    };
  },
};

export const getGraphNodesTool: AgentTool = {
  name: 'get_graph_nodes',
  description: '获取图谱中的节点列表',
  parameters: {
    type: 'object',
    properties: {
      graphId: {
        type: 'string',
        description: '图谱ID',
      },
      level: {
        type: 'string',
        description: '节点级别过滤（root, core, sub, normal, leaf）',
      },
      limit: {
        type: 'number',
        description: '返回数量限制',
      },
    },
    required: ['graphId'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graphId as string;
    const level = params.level as string | undefined;
    const limit = params.limit as number | undefined;
    
    const { data: graphCheck } = await supabase
      .from('knowledge_graphs')
      .select('id')
      .eq('id', graphId)
      .eq('user_id', userId)
      .single();
    
    if (!graphCheck) {
      throw new Error('Graph not found or access denied');
    }
    
    let query = supabase
      .from('graph_nodes')
      .select(`
        id,
        level,
        knowledge_points (
          id,
          title,
          content
        )
      `)
      .eq('graph_id', graphId);
    
    if (level) {
      query = query.eq('level', level);
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: nodes, error } = await query;
    
    if (error) {
      throw new Error(`Failed to get nodes: ${error.message}`);
    }
    
    const formattedNodes = (nodes || []).map(n => {
      const kp = n.knowledge_points as unknown as { id: string; title: string; content: string } | { id: string; title: string; content: string }[] | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      return {
        id: kpData?.id || n.id,
        title: kpData?.title || '',
        content: kpData?.content || '',
        level: n.level,
      };
    });
    
    return {
      nodes: formattedNodes,
      total: formattedNodes.length,
    };
  },
};

export const searchGraphsTool: AgentTool = {
  name: 'search_graphs',
  description: '搜索图谱和节点',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: '搜索关键词',
      },
      type: {
        type: 'string',
        enum: ['graph', 'node', 'all'],
        description: '搜索类型',
      },
    },
    required: ['query'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const query = params.query as string;
    const type = (params.type as string) || 'all';
    
    const results: {
      graphs: Array<{ id: string; title: string; description?: string }>;
      nodes: Array<{ id: string; title: string; graph_id: string; graph_title?: string }>;
    } = {
      graphs: [],
      nodes: [],
    };
    
    if (type === 'graph' || type === 'all') {
      const { data: graphs, error: graphsError } = await supabase
        .from('knowledge_graphs')
        .select('id, title, description')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .or(`title.ilike.%${query}%,description.ilike.%${query}%`);
      
      if (graphsError) {
        throw new Error(`Failed to search graphs: ${graphsError.message}`);
      }
      results.graphs = graphs || [];
    }
    
    if (type === 'node' || type === 'all') {
      const { data: nodes, error: nodesError } = await supabase
        .from('graph_nodes')
        .select(`
          id,
          knowledge_points (
            id,
            title
          ),
          graph_id,
          knowledge_graphs!graph_id (
            id,
            title,
            user_id
          )
        `)
        .ilike('knowledge_points.title', `%${query}%`)
        .eq('knowledge_graphs.user_id', userId);
      
      if (nodesError) {
        throw new Error(`Failed to search nodes: ${nodesError.message}`);
      }
      
      results.nodes = (nodes || []).map(n => {
        const graphData = n.knowledge_graphs as unknown as { id: string; title: string; user_id: string };
        const kpData = n.knowledge_points as unknown as { id: string; title: string };
        return {
          id: kpData?.id || n.id,
          title: kpData?.title || '',
          graph_id: n.graph_id,
          graph_title: graphData?.title,
        };
      });
    }
    
    return results;
  },
};

export const graphTools: AgentTool[] = [
  getGraphOverviewTool,
  getGraphRelationsTool,
  getIsolatedGraphsTool,
  getGraphDetailsTool,
  getGraphNodesTool,
  searchGraphsTool,
];
