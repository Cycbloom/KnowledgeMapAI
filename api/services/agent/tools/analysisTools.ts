import type { AgentTool, ToolContext } from '../types';

export const getDomainDistributionTool: AgentTool = {
  name: 'get_domain_distribution',
  description: '获取知识领域分布统计，返回各领域的图谱数量分布',
  parameters: {
    type: 'object',
    properties: {},
  },
  execute: async (_params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;

    const { data: graphs, error } = await supabase
      .from('knowledge_graphs')
      .select('id, domain')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to get domain distribution: ${error.message}`);
    }

    const domainDistribution: Record<string, number> = {};
    let totalDomains = 0;
    const domainSet = new Set<string>();

    (graphs || []).forEach(graph => {
      const domain = graph.domain || '未分类';
      domainDistribution[domain] = (domainDistribution[domain] || 0) + 1;
      domainSet.add(domain);
    });

    totalDomains = domainSet.size;

    return {
      distribution: domainDistribution,
      totalDomains,
      totalGraphs: graphs?.length || 0,
    };
  },
};

export const analyzeGraphStructureTool: AgentTool = {
  name: 'analyze_graph_structure',
  description: '分析图谱结构特征，包括节点层级分布、边类型分布、平均连接度等',
  parameters: {
    type: 'object',
    properties: {
      graph_id: {
        type: 'string',
        description: '要分析的图谱ID',
      },
    },
    required: ['graph_id'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graph_id as string;

    const { data: graph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title')
      .eq('id', graphId)
      .eq('user_id', userId)
      .single();

    if (graphError || !graph) {
      throw new Error('Graph not found or access denied');
    }

    const { data: nodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select('id, level')
      .eq('graph_id', graphId);

    if (nodesError) {
      throw new Error(`Failed to get nodes: ${nodesError.message}`);
    }

    const { data: edges, error: edgesError } = await supabase
      .from('edges')
      .select('id, relationship_type')
      .eq('graph_id', graphId);

    if (edgesError) {
      throw new Error(`Failed to get edges: ${edgesError.message}`);
    }

    const levelDistribution: Record<string, number> = {};
    (nodes || []).forEach(node => {
      const level = node.level || 'normal';
      levelDistribution[level] = (levelDistribution[level] || 0) + 1;
    });

    const edgeTypeDistribution: Record<string, number> = {};
    (edges || []).forEach(edge => {
      const type = edge.relationship_type || 'unknown';
      edgeTypeDistribution[type] = (edgeTypeDistribution[type] || 0) + 1;
    });

    const nodeCount = nodes?.length || 0;
    const edgeCount = edges?.length || 0;
    const avgConnectivity = nodeCount > 0 ? (edgeCount * 2) / nodeCount : 0;

    const features: string[] = [];
    if (levelDistribution['root'] && levelDistribution['root'] > 0) {
      features.push('存在根节点结构');
    }
    if (avgConnectivity > 2) {
      features.push('高连接密度');
    } else if (avgConnectivity < 1) {
      features.push('低连接密度');
    }
    if (Object.keys(edgeTypeDistribution).length > 3) {
      features.push('关系类型多样化');
    }
    if (levelDistribution['leaf'] && levelDistribution['leaf'] > nodeCount * 0.3) {
      features.push('叶子节点占比高');
    }

    return {
      graphId,
      graphTitle: graph.title,
      levelDistribution,
      edgeTypeDistribution,
      averageConnectivity: Math.round(avgConnectivity * 100) / 100,
      nodeCount,
      edgeCount,
      structuralFeatures: features,
    };
  },
};

export const getLearningPathsTool: AgentTool = {
  name: 'get_learning_paths',
  description: '获取学习路径，基于图谱间的前置关系生成推荐学习顺序',
  parameters: {
    type: 'object',
    properties: {
      start_graph_id: {
        type: 'string',
        description: '起始图谱ID（可选）',
      },
      end_graph_id: {
        type: 'string',
        description: '目标图谱ID（可选）',
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const startGraphId = params.start_graph_id as string | undefined;
    const endGraphId = params.end_graph_id as string | undefined;

    const { data: graphs, error: graphsError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, domain')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (graphsError) {
      throw new Error(`Failed to get graphs: ${graphsError.message}`);
    }

    if (!graphs || graphs.length === 0) {
      return { paths: [], totalPaths: 0 };
    }

    const graphIds = graphs.map(g => g.id);

    const { data: relations, error: relationsError } = await supabase
      .from('graph_relations')
      .select('source_graph_id, target_graph_id, relation_type')
      .or(`source_graph_id.in.(${graphIds.join(',')}),target_graph_id.in.(${graphIds.join(',')})`);

    if (relationsError) {
      throw new Error(`Failed to get relations: ${relationsError.message}`);
    }

    const graphMap = new Map(graphs.map(g => [g.id, g]));
    const adjacencyList = new Map<string, string[]>();
    const inDegree = new Map<string, number>();

    graphIds.forEach(id => {
      adjacencyList.set(id, []);
      inDegree.set(id, 0);
    });

    (relations || [])
      .filter(r => r.relation_type === 'prerequisite')
      .forEach(r => {
        const neighbors = adjacencyList.get(r.source_graph_id) || [];
        neighbors.push(r.target_graph_id);
        adjacencyList.set(r.source_graph_id, neighbors);
        inDegree.set(r.target_graph_id, (inDegree.get(r.target_graph_id) || 0) + 1);
      });

    const paths: Array<{
      graphs: Array<{ id: string; title: string; domain?: string }>;
      description: string;
      estimatedTime: string;
    }> = [];

    const visited = new Set<string>();
    const queue: string[] = [];

    if (startGraphId && graphIds.includes(startGraphId)) {
      queue.push(startGraphId);
    } else {
      inDegree.forEach((degree, graphId) => {
        if (degree === 0) {
          queue.push(graphId);
        }
      });
    }

    const pathGraphs: Array<{ id: string; title: string; domain?: string }> = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;

      visited.add(current);
      const graph = graphMap.get(current);
      if (graph) {
        pathGraphs.push({
          id: graph.id,
          title: graph.title,
          domain: graph.domain,
        });
      }

      if (endGraphId && current === endGraphId) {
        break;
      }

      const neighbors = adjacencyList.get(current) || [];
      neighbors.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 1) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0 && !visited.has(neighbor)) {
          queue.push(neighbor);
        }
      });
    }

    if (pathGraphs.length > 0) {
      const domains = [...new Set(pathGraphs.map(g => g.domain).filter(Boolean))];
      const description = domains.length > 0
        ? `涵盖领域：${domains.join('、')}`
        : '基于前置关系的学习路径';

      paths.push({
        graphs: pathGraphs,
        description,
        estimatedTime: `约 ${pathGraphs.length * 30} 分钟`,
      });
    }

    const unvisitedGraphs = graphIds.filter(id => !visited.has(id));
    if (unvisitedGraphs.length > 0) {
      const isolatedPath: Array<{ id: string; title: string; domain?: string }> = [];
      unvisitedGraphs.forEach(id => {
        const graph = graphMap.get(id);
        if (graph) {
          isolatedPath.push({
            id: graph.id,
            title: graph.title,
            domain: graph.domain,
          });
        }
      });

      if (isolatedPath.length > 0) {
        paths.push({
          graphs: isolatedPath,
          description: '独立图谱（无前置关系）',
          estimatedTime: `约 ${isolatedPath.length * 30} 分钟`,
        });
      }
    }

    return {
      paths,
      totalPaths: paths.length,
    };
  },
};

export const getSimilarGraphsTool: AgentTool = {
  name: 'get_similar_graphs',
  description: '获取与指定图谱相似的其他图谱，基于共同概念和结构相似度',
  parameters: {
    type: 'object',
    properties: {
      graph_id: {
        type: 'string',
        description: '目标图谱ID',
      },
      threshold: {
        type: 'number',
        description: '相似度阈值（0-1之间，默认0.3）',
      },
    },
    required: ['graph_id'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graph_id as string;
    const threshold = (params.threshold as number) ?? 0.3;

    const { data: targetGraph, error: targetError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, domain')
      .eq('id', graphId)
      .eq('user_id', userId)
      .single();

    if (targetError || !targetGraph) {
      throw new Error('Graph not found or access denied');
    }

    const { data: targetNodes, error: targetNodesError } = await supabase
      .from('graph_nodes')
      .select(`
        id,
        knowledge_points (
          title
        )
      `)
      .eq('graph_id', graphId);

    if (targetNodesError) {
      throw new Error(`Failed to get target nodes: ${targetNodesError.message}`);
    }

    const targetKeywords = new Set<string>();
    (targetNodes || []).forEach(node => {
      const kp = node.knowledge_points as unknown as { title: string } | { title: string }[] | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      if (kpData?.title) {
        targetKeywords.add(kpData.title.toLowerCase());
      }
    });

    const { data: otherGraphs, error: otherError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, domain')
      .eq('user_id', userId)
      .neq('id', graphId)
      .is('deleted_at', null);

    if (otherError) {
      throw new Error(`Failed to get other graphs: ${otherError.message}`);
    }

    if (!otherGraphs || otherGraphs.length === 0) {
      return { similarGraphs: [], totalSimilar: 0 };
    }

    const otherGraphIds = otherGraphs.map(g => g.id);

    const { data: otherNodes, error: otherNodesError } = await supabase
      .from('graph_nodes')
      .select(`
        graph_id,
        knowledge_points (
          title
        )
      `)
      .in('graph_id', otherGraphIds);

    if (otherNodesError) {
      throw new Error(`Failed to get other nodes: ${otherNodesError.message}`);
    }

    const graphKeywords = new Map<string, Set<string>>();
    (otherNodes || []).forEach(node => {
      if (!graphKeywords.has(node.graph_id)) {
        graphKeywords.set(node.graph_id, new Set());
      }
      const kp = node.knowledge_points as unknown as { title: string } | { title: string }[] | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      if (kpData?.title) {
        graphKeywords.get(node.graph_id)!.add(kpData.title.toLowerCase());
      }
    });

    const similarGraphs: Array<{
      id: string;
      title: string;
      domain?: string;
      similarity: number;
      commonConcepts: string[];
    }> = [];

    otherGraphs.forEach(graph => {
      const keywords = graphKeywords.get(graph.id) || new Set();
      const commonConcepts: string[] = [];
      let matchCount = 0;

      keywords.forEach(keyword => {
        if (targetKeywords.has(keyword)) {
          matchCount++;
          commonConcepts.push(keyword);
        }
      });

      const unionSize = targetKeywords.size + keywords.size - matchCount;
      const similarity = unionSize > 0 ? matchCount / unionSize : 0;

      if (similarity >= threshold) {
        similarGraphs.push({
          id: graph.id,
          title: graph.title,
          domain: graph.domain,
          similarity: Math.round(similarity * 100) / 100,
          commonConcepts: commonConcepts.slice(0, 10),
        });
      }
    });

    similarGraphs.sort((a, b) => b.similarity - a.similarity);

    return {
      similarGraphs,
      totalSimilar: similarGraphs.length,
      targetGraph: {
        id: targetGraph.id,
        title: targetGraph.title,
      },
    };
  },
};

export const getKnowledgeCoverageTool: AgentTool = {
  name: 'get_knowledge_coverage',
  description: '获取知识覆盖度统计，包括图谱连接率和孤岛图谱信息',
  parameters: {
    type: 'object',
    properties: {
      domain: {
        type: 'string',
        description: '指定领域进行过滤（可选）',
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const domain = params.domain as string | undefined;

    let graphsQuery = supabase
      .from('knowledge_graphs')
      .select('id, title, domain')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (domain) {
      graphsQuery = graphsQuery.eq('domain', domain);
    }

    const { data: graphs, error: graphsError } = await graphsQuery;

    if (graphsError) {
      throw new Error(`Failed to get graphs: ${graphsError.message}`);
    }

    if (!graphs || graphs.length === 0) {
      return {
        totalGraphs: 0,
        totalNodes: 0,
        connectedGraphs: 0,
        isolatedGraphs: 0,
        connectivityRate: 0,
        domain: domain || '全部',
      };
    }

    const graphIds = graphs.map(g => g.id);

    const { count: nodeCount, error: nodeError } = await supabase
      .from('graph_nodes')
      .select('id', { count: 'exact', head: true })
      .in('graph_id', graphIds);

    if (nodeError) {
      throw new Error(`Failed to get node count: ${nodeError.message}`);
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
      if (graphIds.includes(r.source_graph_id)) {
        connectedGraphIds.add(r.source_graph_id);
      }
      if (graphIds.includes(r.target_graph_id)) {
        connectedGraphIds.add(r.target_graph_id);
      }
    });

    const totalGraphs = graphs.length;
    const connectedGraphs = connectedGraphIds.size;
    const isolatedGraphs = totalGraphs - connectedGraphs;
    const connectivityRate = totalGraphs > 0 ? connectedGraphs / totalGraphs : 0;

    return {
      totalGraphs,
      totalNodes: nodeCount || 0,
      connectedGraphs,
      isolatedGraphs,
      connectivityRate: Math.round(connectivityRate * 100) / 100,
      domain: domain || '全部',
    };
  },
};

export const analyzeMergeCandidatesTool: AgentTool = {
  name: 'analyze_merge_candidates',
  description: '分析可能适合合并的图谱对，基于相似度和内容重叠度',
  parameters: {
    type: 'object',
    properties: {
      similarity_threshold: {
        type: 'number',
        description: '相似度阈值（0-1之间，默认0.5）',
      },
      max_candidates: {
        type: 'number',
        description: '最大返回候选数量（默认10）',
      },
    },
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const similarityThreshold = (params.similarity_threshold as number) ?? 0.5;
    const maxCandidates = (params.max_candidates as number) ?? 10;

    const { data: graphs, error: graphsError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, domain')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (graphsError) {
      throw new Error(`Failed to get graphs: ${graphsError.message}`);
    }

    if (!graphs || graphs.length < 2) {
      return { candidates: [], totalCandidates: 0 };
    }

    const graphIds = graphs.map(g => g.id);

    const { data: allNodes, error: nodesError } = await supabase
      .from('graph_nodes')
      .select(`
        graph_id,
        knowledge_points (
          title
        )
      `)
      .in('graph_id', graphIds);

    if (nodesError) {
      throw new Error(`Failed to get nodes: ${nodesError.message}`);
    }

    const graphKeywords = new Map<string, Set<string>>();
    (allNodes || []).forEach(node => {
      if (!graphKeywords.has(node.graph_id)) {
        graphKeywords.set(node.graph_id, new Set());
      }
      const kp = node.knowledge_points as unknown as { title: string } | { title: string }[] | null;
      const kpData = Array.isArray(kp) ? kp[0] : kp;
      if (kpData?.title) {
        graphKeywords.get(node.graph_id)!.add(kpData.title.toLowerCase());
      }
    });

    const candidates: Array<{
      graph1: { id: string; title: string; domain?: string };
      graph2: { id: string; title: string; domain?: string };
      similarity: number;
      commonConcepts: string[];
      suggestedAction: string;
    }> = [];

    for (let i = 0; i < graphs.length && candidates.length < maxCandidates; i++) {
      for (let j = i + 1; j < graphs.length && candidates.length < maxCandidates; j++) {
        const graph1 = graphs[i];
        const graph2 = graphs[j];

        const keywords1 = graphKeywords.get(graph1.id) || new Set();
        const keywords2 = graphKeywords.get(graph2.id) || new Set();

        const commonConcepts: string[] = [];
        let matchCount = 0;

        keywords1.forEach(keyword => {
          if (keywords2.has(keyword)) {
            matchCount++;
            commonConcepts.push(keyword);
          }
        });

        const unionSize = keywords1.size + keywords2.size - matchCount;
        const similarity = unionSize > 0 ? matchCount / unionSize : 0;

        if (similarity >= similarityThreshold) {
          let suggestedAction = '考虑合并';
          if (graph1.domain === graph2.domain && graph1.domain) {
            suggestedAction = '强烈建议合并（同领域）';
          } else if (similarity >= 0.7) {
            suggestedAction = '高度相似，建议合并';
          }

          candidates.push({
            graph1: {
              id: graph1.id,
              title: graph1.title,
              domain: graph1.domain,
            },
            graph2: {
              id: graph2.id,
              title: graph2.title,
              domain: graph2.domain,
            },
            similarity: Math.round(similarity * 100) / 100,
            commonConcepts: commonConcepts.slice(0, 5),
            suggestedAction,
          });
        }
      }
    }

    candidates.sort((a, b) => b.similarity - a.similarity);

    return {
      candidates: candidates.slice(0, maxCandidates),
      totalCandidates: candidates.length,
    };
  },
};

export const analysisTools: AgentTool[] = [
  getDomainDistributionTool,
  analyzeGraphStructureTool,
  getLearningPathsTool,
  getSimilarGraphsTool,
  getKnowledgeCoverageTool,
  analyzeMergeCandidatesTool,
];
