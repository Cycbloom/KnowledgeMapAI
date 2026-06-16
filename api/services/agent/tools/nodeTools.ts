import type { AgentTool, ToolContext } from '../types';

interface TagInfo {
  name: string;
  count: number;
}

export const getGraphTagsTool: AgentTool = {
  name: 'get_graph_tags',
  description: '获取图谱中所有知识点的标签（关键词），返回标签名称和出现次数的统计信息',
  parameters: {
    type: 'object',
    properties: {
      graph_id: {
        type: 'string',
        description: '图谱ID',
      },
      summarize: {
        type: 'boolean',
        description: '是否返回精简版本，默认true',
      },
    },
    required: ['graph_id'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graph_id as string;

    const { data: graphCheck, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id')
      .eq('id', graphId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (graphError || !graphCheck) {
      throw new Error('Graph not found or access denied');
    }

    const { data: nodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select(`
        knowledge_point_id,
        knowledge_points (
          keywords
        )
      `)
      .eq('graph_id', graphId)
      .is('deleted_at', null);

    if (nodesError) {
      throw new Error(`Failed to get nodes: ${nodesError.message}`);
    }

    const tagCountMap = new Map<string, number>();

    (nodes || []).forEach(node => {
      const kp = node.knowledge_points as unknown as { keywords: Array<{ term: string }> } | null;
      if (kp?.keywords && Array.isArray(kp.keywords)) {
        kp.keywords.forEach(keyword => {
          if (keyword?.term) {
            const currentCount = tagCountMap.get(keyword.term) || 0;
            tagCountMap.set(keyword.term, currentCount + 1);
          }
        });
      }
    });

    const tags: TagInfo[] = Array.from(tagCountMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return {
      graphId,
      tags,
      totalUniqueTags: tags.length,
      totalOccurrences: tags.reduce((sum, tag) => sum + tag.count, 0),
    };
  },
};

export const getNodeRelationsTool: AgentTool = {
  name: 'get_node_relations',
  description: '获取指定知识点节点的关系网络，包括上游节点（前置依赖）和下游节点（后续扩展），支持指定查询深度',
  category: "read" as const,
  riskLevel: "low" as const,
  parameters: {
    type: 'object',
    properties: {
      node_id: {
        type: 'string',
        description: '知识点ID',
      },
      depth: {
        type: 'number',
        description: '关系网络查询深度，默认为1。深度越大，返回的关系网络越广',
      },
      summarize: {
        type: 'boolean',
        description: '是否返回精简版本，默认true',
      },
    },
    required: ['node_id'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const nodeId = params.node_id as string;
    const depth = (params.depth as number) ?? 1;
    const summarize = params.summarize !== false;

    if (depth < 1 || depth > 5) {
      throw new Error('Depth must be between 1 and 5');
    }

    const { data: kpCheck, error: kpError } = await supabase
      .from('knowledge_points')
      .select('id, title')
      .eq('id', nodeId)
      .single();

    if (kpError || !kpCheck) {
      throw new Error('Knowledge point not found');
    }

    const { data: graphNodes, error: gnError } = await supabase
      .from('graph_nodes')
      .select(`
        graph_id,
        knowledge_graphs (
          id,
          user_id
        )
      `)
      .eq('knowledge_point_id', nodeId)
      .is('deleted_at', null);

    if (gnError) {
      throw new Error(`Failed to get graph nodes: ${gnError.message}`);
    }

    const userGraphIds = (graphNodes || [])
      .filter(gn => {
        const graph = gn.knowledge_graphs as unknown as { id: string; user_id: string } | null;
        return graph?.user_id === userId;
      })
      .map(gn => gn.graph_id);

    if (userGraphIds.length === 0) {
      throw new Error('Access denied: node not found in your graphs');
    }

    const visitedNodes = new Set<string>([nodeId]);
    const nodeIdToIdx: Record<string, number> = {};
    const nodeIdxToTitle: Record<string, string> = {};
    let idxCounter = 0;

    const assignIdx = (id: string, title: string) => {
      if (nodeIdToIdx[id] === undefined) {
        nodeIdToIdx[id] = idxCounter;
        nodeIdxToTitle[idxCounter] = title;
        idxCounter++;
      }
    };

    assignIdx(nodeId, kpCheck.title);

    const upstreamNodes: Array<{ idx?: number; id?: string; title: string; relationType: string }> = [];
    const downstreamNodes: Array<{ idx?: number; id?: string; title: string; relationType: string }> = [];

    const collectRelations = async (
      currentNodes: string[],
      currentDepth: number,
      direction: 'upstream' | 'downstream'
    ): Promise<void> => {
      if (currentDepth > depth || currentNodes.length === 0) {
        return;
      }

      const query = supabase
        .from('edges')
        .select(`
          id,
          relationship_type,
          source_knowledge_point_id,
          target_knowledge_point_id,
          graph_id
        `)
        .in('graph_id', userGraphIds)
        .is('deleted_at', null);

      let edges: Array<{
        id: string;
        relationship_type: string;
        source_knowledge_point_id: string;
        target_knowledge_point_id: string;
        graph_id: string;
      }>;

      if (direction === 'upstream') {
        const { data, error } = await query.in('target_knowledge_point_id', currentNodes);
        if (error) throw new Error(`Failed to get upstream edges: ${error.message}`);
        edges = data || [];
      } else {
        const { data, error } = await query.in('source_knowledge_point_id', currentNodes);
        if (error) throw new Error(`Failed to get downstream edges: ${error.message}`);
        edges = data || [];
      }

      const newNodeIds = new Set<string>();

      for (const edge of edges) {
        const relatedNodeId = direction === 'upstream'
          ? edge.source_knowledge_point_id
          : edge.target_knowledge_point_id;

        if (visitedNodes.has(relatedNodeId)) {
          continue;
        }

        visitedNodes.add(relatedNodeId);
        newNodeIds.add(relatedNodeId);

        const { data: relatedKp } = await supabase
          .from('knowledge_points')
          .select('id, title')
          .eq('id', relatedNodeId)
          .single();

        if (!relatedKp) {
          continue;
        }

        assignIdx(relatedNodeId, relatedKp.title);

        const relation = summarize
          ? {
              idx: nodeIdToIdx[relatedNodeId],
              title: relatedKp.title,
              relationType: edge.relationship_type,
            }
          : {
              id: relatedNodeId,
              title: relatedKp.title,
              relationType: edge.relationship_type,
            };

        if (direction === 'upstream') {
          upstreamNodes.push(relation);
        } else {
          downstreamNodes.push(relation);
        }
      }

      if (newNodeIds.size > 0) {
        await collectRelations(Array.from(newNodeIds), currentDepth + 1, direction);
      }
    };

    await Promise.all([
      collectRelations([nodeId], 1, 'upstream'),
      collectRelations([nodeId], 1, 'downstream'),
    ]);

    if (summarize) {
      return {
        node: {
          idx: 0,
          title: kpCheck.title,
        },
        upstream: upstreamNodes,
        downstream: downstreamNodes,
        nodeIndex: nodeIdxToTitle,
        totalRelations: upstreamNodes.length + downstreamNodes.length,
        depth,
      };
    }

    return {
      nodeId,
      nodeTitle: kpCheck.title,
      upstreamNodes: upstreamNodes.map(n => ({
        id: n.id!,
        title: n.title,
        relationshipType: n.relationType,
        direction: 'upstream' as const,
      })),
      downstreamNodes: downstreamNodes.map(n => ({
        id: n.id!,
        title: n.title,
        relationshipType: n.relationType,
        direction: 'downstream' as const,
      })),
      totalRelations: upstreamNodes.length + downstreamNodes.length,
      depth,
    };
  },
};

export const nodeTools: AgentTool[] = [
  getGraphTagsTool,
  getNodeRelationsTool,
];
