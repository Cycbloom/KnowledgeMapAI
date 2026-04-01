import type { AgentTool, ToolContext } from '../types';

export const getStudyProgressTool: AgentTool = {
  name: 'get_study_progress',
  description: '获取用户的学习进度统计，包括已完成、进行中和未开始的图谱数量及总体进度百分比',
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
      .select('id, title')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (graphIds && graphIds.length > 0) {
      query = query.in('id', graphIds);
    }

    const { data: graphs, error: graphsError } = await query;

    if (graphsError) {
      throw new Error(`Failed to get graphs: ${graphsError.message}`);
    }

    const allGraphIds = (graphs || []).map(g => g.id);

    if (allGraphIds.length === 0) {
      return {
        completedCount: 0,
        inProgressCount: 0,
        notStartedCount: 0,
        totalGraphs: 0,
        overallProgress: 0,
        details: [],
      };
    }

    const { data: progressData, error: progressError } = await supabase
      .from('study_progress')
      .select('graph_id, total_nodes, mastered_nodes, progress_percentage, study_streak')
      .eq('user_id', userId)
      .in('graph_id', allGraphIds);

    if (progressError) {
      throw new Error(`Failed to get study progress: ${progressError.message}`);
    }

    const progressMap = new Map<string, typeof progressData extends (infer T)[] ? T : never>();
    (progressData || []).forEach(p => {
      progressMap.set(p.graph_id, p);
    });

    let completedCount = 0;
    let inProgressCount = 0;
    let notStartedCount = 0;
    let totalProgress = 0;

    const details = (graphs || []).map(graph => {
      const progress = progressMap.get(graph.id);
      const percentage = progress?.progress_percentage || 0;

      if (percentage >= 100) {
        completedCount++;
      } else if (percentage > 0) {
        inProgressCount++;
      } else {
        notStartedCount++;
      }

      totalProgress += percentage;

      return {
        graphId: graph.id,
        graphTitle: graph.title,
        totalNodes: progress?.total_nodes || 0,
        masteredNodes: progress?.mastered_nodes || 0,
        progressPercentage: percentage,
        studyStreak: progress?.study_streak || 0,
        status: percentage >= 100 ? 'completed' : percentage > 0 ? 'in_progress' : 'not_started',
      };
    });

    const overallProgress = allGraphIds.length > 0
      ? Math.round(totalProgress / allGraphIds.length)
      : 0;

    return {
      completedCount,
      inProgressCount,
      notStartedCount,
      totalGraphs: allGraphIds.length,
      overallProgress,
      details,
    };
  },
};

export const analyzeDifficultyTool: AgentTool = {
  name: 'analyze_difficulty',
  description: '分析指定知识图谱的难度等级，返回难度评分（1-5）、难度因素分析和建议学习时间',
  parameters: {
    type: 'object',
    properties: {
      graphId: {
        type: 'string',
        description: '要分析的图谱ID',
      },
    },
    required: ['graphId'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graphId as string;

    const { data: graph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
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
      .select('id, level')
      .eq('graph_id', graphId);

    if (nodesError) {
      throw new Error(`Failed to get nodes: ${nodesError.message}`);
    }

    const { count: edgeCount, error: edgesError } = await supabase
      .from('edges')
      .select('id', { count: 'exact', head: true })
      .eq('graph_id', graphId);

    if (edgesError) {
      throw new Error(`Failed to get edges: ${edgesError.message}`);
    }

    const nodeCount = nodes?.length || 0;
    const totalEdges = edgeCount || 0;

    const levelCounts: Record<string, number> = {
      root: 0,
      core: 0,
      sub: 0,
      normal: 0,
      leaf: 0,
    };

    (nodes || []).forEach(node => {
      const level = node.level || 'normal';
      levelCounts[level] = (levelCounts[level] || 0) + 1;
    });

    const maxDepth = Math.max(
      levelCounts.root > 0 ? 1 : 0,
      levelCounts.core > 0 ? 2 : 0,
      levelCounts.sub > 0 ? 3 : 0,
      levelCounts.normal > 0 ? 4 : 0,
      levelCounts.leaf > 0 ? 5 : 0
    );

    const factors: string[] = [];
    let difficultyScore = 1;

    if (nodeCount > 50) {
      difficultyScore += 1;
      factors.push('知识点数量较多（超过50个）');
    } else if (nodeCount > 20) {
      difficultyScore += 0.5;
      factors.push('知识点数量适中（20-50个）');
    }

    if (totalEdges > 100) {
      difficultyScore += 1;
      factors.push('知识关联复杂（超过100条关系）');
    } else if (totalEdges > 40) {
      difficultyScore += 0.5;
      factors.push('知识关联较复杂（40-100条关系）');
    }

    if (maxDepth >= 4) {
      difficultyScore += 1;
      factors.push('知识层级较深（4层以上）');
    } else if (maxDepth >= 3) {
      difficultyScore += 0.5;
      factors.push('知识层级适中（3层）');
    }

    const avgConnections = nodeCount > 0 ? totalEdges / nodeCount : 0;
    if (avgConnections > 3) {
      difficultyScore += 0.5;
      factors.push('知识点平均关联度高');
    }

    const { data: prerequisites, error: prereqError } = await supabase
      .from('graph_relations')
      .select('source_graph_id')
      .eq('target_graph_id', graphId)
      .eq('relation_type', 'prerequisite');

    if (!prereqError && prerequisites && prerequisites.length > 0) {
      difficultyScore += 0.5;
      factors.push(`需要先学习${prerequisites.length}个前置图谱`);
    }

    const finalDifficulty = Math.min(5, Math.max(1, Math.round(difficultyScore)));

    const baseTime = 30;
    const estimatedMinutes = Math.round(
      baseTime + (nodeCount * 5) + (totalEdges * 2) + (maxDepth * 10)
    );

    const difficultyLabels = ['入门', '基础', '中等', '进阶', '专家'];
    const suggestedHours = Math.ceil(estimatedMinutes / 60);

    return {
      graphId: graph.id,
      graphTitle: graph.title,
      difficultyLevel: finalDifficulty,
      difficultyLabel: difficultyLabels[finalDifficulty - 1],
      factors: factors.length > 0 ? factors : ['知识点数量较少，适合入门学习'],
      estimatedStudyTime: {
        minutes: estimatedMinutes,
        hours: suggestedHours,
        display: suggestedHours > 1 ? `约${suggestedHours}小时` : `约${estimatedMinutes}分钟`,
      },
      analysis: {
        nodeCount,
        edgeCount: totalEdges,
        maxDepth,
        averageConnections: Math.round(avgConnections * 10) / 10,
        prerequisiteCount: prerequisites?.length || 0,
      },
    };
  },
};

export const getPrerequisiteChainTool: AgentTool = {
  name: 'get_prerequisite_chain',
  description: '获取指定图谱的前置知识链，返回需要按顺序学习的图谱序列及每步说明',
  parameters: {
    type: 'object',
    properties: {
      graphId: {
        type: 'string',
        description: '要查询前置知识链的图谱ID',
      },
    },
    required: ['graphId'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graphId as string;

    const { data: targetGraph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .eq('id', graphId)
      .eq('user_id', userId)
      .single();

    if (graphError) {
      throw new Error(`Failed to get graph: ${graphError.message}`);
    }

    if (!targetGraph) {
      throw new Error('Graph not found');
    }

    const { data: userGraphs, error: userGraphsError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (userGraphsError) {
      throw new Error(`Failed to get user graphs: ${userGraphsError.message}`);
    }

    const userGraphIds = (userGraphs || []).map(g => g.id);
    const graphMap = new Map((userGraphs || []).map(g => [g.id, g]));

    const { data: relations, error: relationsError } = await supabase
      .from('graph_relations')
      .select('source_graph_id, target_graph_id, context')
      .eq('relation_type', 'prerequisite')
      .in('target_graph_id', userGraphIds);

    if (relationsError) {
      throw new Error(`Failed to get relations: ${relationsError.message}`);
    }

    const prerequisiteMap = new Map<string, Array<{ id: string; context: string }>>();
    (relations || []).forEach(r => {
      if (!prerequisiteMap.has(r.target_graph_id)) {
        prerequisiteMap.set(r.target_graph_id, []);
      }
      const prereqList = prerequisiteMap.get(r.target_graph_id);
      if (prereqList) {
        prereqList.push({
          id: r.source_graph_id,
          context: r.context || '',
        });
      }
    });

    const visited = new Set<string>();

    const buildChain = (currentId: string, path: string[]) => {
      if (visited.has(currentId)) {
        return;
      }

      if (path.includes(currentId)) {
        return;
      }

      visited.add(currentId);
      const prerequisites = prerequisiteMap.get(currentId) || [];

      for (const prereq of prerequisites) {
        buildChain(prereq.id, [...path, currentId]);
      }
    };

    buildChain(graphId, []);

    const orderedIds = Array.from(visited).filter(id => id !== graphId);

    const { data: progressData } = await supabase
      .from('study_progress')
      .select('graph_id, progress_percentage')
      .eq('user_id', userId)
      .in('graph_id', orderedIds);

    const progressMap = new Map<string, number>();
    (progressData || []).forEach(p => {
      progressMap.set(p.graph_id, p.progress_percentage || 0);
    });

    let order = 1;
    const chainWithDetails = orderedIds.map(id => {
      const graph = graphMap.get(id);
      let reason = '前置知识';

      for (const r of relations || []) {
        if (r.source_graph_id === id && orderedIds.includes(r.target_graph_id)) {
          reason = r.context || `是「${graphMap.get(r.target_graph_id)?.title || '未知图谱'}」的前置知识`;
          break;
        }
      }

      return {
        graphId: id,
        graphTitle: graph?.title || '未知图谱',
        description: graph?.description || '',
        reason,
        order: order++,
        progress: progressMap.get(id) || 0,
        status: (progressMap.get(id) || 0) >= 100 ? 'completed' :
                (progressMap.get(id) || 0) > 0 ? 'in_progress' : 'not_started',
      };
    });

    return {
      targetGraph: {
        id: targetGraph.id,
        title: targetGraph.title,
        description: targetGraph.description,
      },
      prerequisiteChain: chainWithDetails,
      totalPrerequisites: chainWithDetails.length,
      completedPrerequisites: chainWithDetails.filter(c => c.status === 'completed').length,
      readyToLearn: chainWithDetails.every(c => c.status === 'completed'),
      summary: chainWithDetails.length === 0
        ? '该图谱没有前置知识要求，可以直接开始学习'
        : `需要先学习${chainWithDetails.length}个前置图谱`,
    };
  },
};

export const getExtensionSuggestionsTool: AgentTool = {
  name: 'get_extension_suggestions',
  description: '获取指定图谱的扩展学习建议，返回推荐的扩展图谱列表及推荐理由',
  parameters: {
    type: 'object',
    properties: {
      graphId: {
        type: 'string',
        description: '要获取扩展建议的图谱ID',
      },
    },
    required: ['graphId'],
  },
  execute: async (params: Record<string, unknown>, context: ToolContext) => {
    const { supabase, userId } = context;
    const graphId = params.graphId as string;

    const { data: sourceGraph, error: graphError } = await supabase
      .from('knowledge_graphs')
      .select('id, title, description')
      .eq('id', graphId)
      .eq('user_id', userId)
      .single();

    if (graphError) {
      throw new Error(`Failed to get graph: ${graphError.message}`);
    }

    if (!sourceGraph) {
      throw new Error('Graph not found');
    }

    const { data: extensionRelations, error: relationsError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        target_graph_id,
        context,
        confidence,
        shared_concepts,
        knowledge_graphs!graph_relations_target_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('source_graph_id', graphId)
      .eq('relation_type', 'extension');

    if (relationsError) {
      throw new Error(`Failed to get extension relations: ${relationsError.message}`);
    }

    const { data: relatedRelations, error: relatedError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        target_graph_id,
        context,
        confidence,
        shared_concepts,
        knowledge_graphs!graph_relations_target_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('source_graph_id', graphId)
      .eq('relation_type', 'related');

    if (relatedError) {
      throw new Error(`Failed to get related relations: ${relatedError.message}`);
    }

    const { data: crossDomainRelations, error: crossError } = await supabase
      .from('graph_relations')
      .select(`
        id,
        target_graph_id,
        context,
        confidence,
        shared_concepts,
        knowledge_graphs!graph_relations_target_graph_id_fkey (
          id,
          title,
          description
        )
      `)
      .eq('source_graph_id', graphId)
      .eq('relation_type', 'cross_domain');

    if (crossError) {
      throw new Error(`Failed to get cross-domain relations: ${crossError.message}`);
    }

    const targetIds = [
      ...(extensionRelations || []).map(r => r.target_graph_id),
      ...(relatedRelations || []).map(r => r.target_graph_id),
      ...(crossDomainRelations || []).map(r => r.target_graph_id),
    ];

    const { data: progressData } = await supabase
      .from('study_progress')
      .select('graph_id, progress_percentage')
      .eq('user_id', userId)
      .in('graph_id', targetIds);

    const progressMap = new Map<string, number>();
    (progressData || []).forEach(p => {
      progressMap.set(p.graph_id, p.progress_percentage || 0);
    });

    const formatSuggestion = (
      relation: typeof extensionRelations extends (infer T)[] ? T : never,
      type: 'extension' | 'related' | 'cross_domain'
    ) => {
      const graphData = relation.knowledge_graphs as unknown as {
        id: string;
        title: string;
        description: string;
      } | null;

      const typeLabels = {
        extension: '进阶学习',
        related: '相关知识',
        cross_domain: '跨领域拓展',
      };

      const typeReasons = {
        extension: '是当前图谱的进阶内容，适合深入学习',
        related: '与当前图谱相关，可以拓展知识面',
        cross_domain: '跨领域知识，有助于建立更广阔的知识体系',
      };

      return {
        graphId: relation.target_graph_id,
        graphTitle: graphData?.title || '未知图谱',
        description: graphData?.description || '',
        suggestionType: type,
        typeLabel: typeLabels[type],
        reason: relation.context || typeReasons[type],
        confidence: relation.confidence || 0.8,
        sharedConcepts: relation.shared_concepts || [],
        progress: progressMap.get(relation.target_graph_id) || 0,
        status: (progressMap.get(relation.target_graph_id) || 0) >= 100 ? 'completed' :
                (progressMap.get(relation.target_graph_id) || 0) > 0 ? 'in_progress' : 'not_started',
      };
    };

    const suggestions = [
      ...(extensionRelations || []).map(r => formatSuggestion(r, 'extension')),
      ...(relatedRelations || []).map(r => formatSuggestion(r, 'related')),
      ...(crossDomainRelations || []).map(r => formatSuggestion(r, 'cross_domain')),
    ];

    suggestions.sort((a, b) => {
      const statusOrder: Record<string, number> = { not_started: 0, in_progress: 1, completed: 2 };
      const statusDiff = (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0);
      if (statusDiff !== 0) return statusDiff;
      return b.confidence - a.confidence;
    });

    const categorized = {
      extension: suggestions.filter(s => s.suggestionType === 'extension'),
      related: suggestions.filter(s => s.suggestionType === 'related'),
      crossDomain: suggestions.filter(s => s.suggestionType === 'cross_domain'),
    };

    return {
      sourceGraph: {
        id: sourceGraph.id,
        title: sourceGraph.title,
        description: sourceGraph.description,
      },
      suggestions,
      categorized,
      totalSuggestions: suggestions.length,
      notStartedCount: suggestions.filter(s => s.status === 'not_started').length,
      inProgressCount: suggestions.filter(s => s.status === 'in_progress').length,
      completedCount: suggestions.filter(s => s.status === 'completed').length,
      summary: suggestions.length === 0
        ? '暂无扩展学习建议，可以尝试创建相关图谱'
        : `发现${suggestions.length}个扩展学习建议`,
    };
  },
};

export const learningTools: AgentTool[] = [
  getStudyProgressTool,
  analyzeDifficultyTool,
  getPrerequisiteChainTool,
  getExtensionSuggestionsTool,
];
