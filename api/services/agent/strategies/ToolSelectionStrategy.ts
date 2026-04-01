import type { AnalysisGoal, ToolSelectionStrategy } from '../types';

const STRATEGIES: Record<AnalysisGoal, ToolSelectionStrategy> = {
  knowledge_completeness: {
    primaryTools: ['get_graph_overview', 'get_graph_nodes'],
    secondaryTools: ['get_graph_details', 'get_graph_relations'],
    depthTools: ['get_node_relations', 'search_nodes'],
  },
  relation_discovery: {
    primaryTools: ['get_graph_overview', 'get_graph_relations'],
    secondaryTools: ['get_graph_details', 'search_graphs'],
    depthTools: ['get_similar_graphs', 'get_node_relations'],
  },
  learning_optimization: {
    primaryTools: ['get_graph_overview', 'get_graph_relations'],
    secondaryTools: ['get_learning_path', 'get_study_progress'],
    depthTools: ['get_prerequisite_chain', 'get_difficulty_analysis'],
  },
  island_detection: {
    primaryTools: ['get_graph_overview', 'get_isolated_graphs'],
    secondaryTools: ['get_graph_details', 'search_graphs'],
    depthTools: ['get_similar_graphs', 'get_merge_suggestions'],
  },
  cross_domain: {
    primaryTools: ['get_graph_overview', 'get_domain_distribution'],
    secondaryTools: ['get_graph_details', 'search_graphs'],
    depthTools: ['get_similar_graphs', 'get_cross_domain_relations'],
  },
  custom: {
    primaryTools: ['get_graph_overview'],
    secondaryTools: ['get_graph_details', 'get_graph_relations'],
    depthTools: ['search_graphs', 'search_nodes'],
  },
};

export function getStrategyForGoal(goal: AnalysisGoal): ToolSelectionStrategy | null {
  return STRATEGIES[goal] || null;
}

export function getAllStrategies(): Record<AnalysisGoal, ToolSelectionStrategy> {
  return { ...STRATEGIES };
}

export function getAvailableToolsForGoal(goal: AnalysisGoal): string[] {
  const strategy = STRATEGIES[goal];
  if (!strategy) {
    return [];
  }
  return [
    ...strategy.primaryTools,
    ...strategy.secondaryTools,
    ...strategy.depthTools,
  ];
}
