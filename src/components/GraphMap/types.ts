import type {
  DiscoveredRelation,
  CrossDomainInsight,
} from '@shared/types/graph';

export type AnalysisModuleId = 'relations' | 'crossDomain' | 'learningPaths' | 'knowledgeGaps';
export type AnalysisModuleStatus = 'idle' | 'loading' | 'completed' | 'error';

export interface AnalysisModuleState {
  id: AnalysisModuleId;
  name: string;
  description: string;
  estimatedTime: string;
  status: AnalysisModuleStatus;
  result: unknown;
  error?: string;
  selected: boolean;
}

export type AnalysisPromptScenarioId = 
  | 'relation_discovery' 
  | 'cross_domain_insights' 
  | 'learning_path_suggestions' 
  | 'knowledge_gaps';

export const MODULE_TO_SCENARIO: Record<AnalysisModuleId, AnalysisPromptScenarioId> = {
  relations: 'relation_discovery',
  crossDomain: 'cross_domain_insights',
  learningPaths: 'learning_path_suggestions',
  knowledgeGaps: 'knowledge_gaps',
};

export interface ModularAnalysisPanelProps {
  isOpen: boolean;
  onClose: () => void;
  modules: AnalysisModuleState[];
  onToggleModule: (moduleId: AnalysisModuleId) => void;
  onExecuteModules: (selectedIds: AnalysisModuleId[]) => void;
  onViewResult: (moduleId: AnalysisModuleId) => void;
  onEditPrompt?: (moduleId: AnalysisModuleId) => void;
  promptContents?: Record<AnalysisModuleId, string>;
}

export interface AnalysisModuleCardProps {
  module: AnalysisModuleState;
  onToggle: () => void;
  onViewResult: () => void;
  onEditPrompt?: () => void;
  disabled?: boolean;
}

export interface RelationAnalysisResult {
  discovered_relations: DiscoveredRelation[];
  analysis_summary: {
    total_graphs_analyzed: number;
    relations_discovered: number;
    isolated_graphs: string[];
  };
}

export interface CrossDomainAnalysisResult {
  cross_domain_insights: CrossDomainInsight[];
  domain_distribution: Record<string, number>;
  analysis_summary: {
    total_domains: number;
    cross_domain_clusters: number;
  };
}

export interface LearningPathAnalysisResult {
  learning_path_suggestions: Array<{
    path: string[];
    path_titles: string[];
    description: string;
    estimated_time: string;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  }>;
  analysis_summary: {
    total_paths: number;
    avg_path_length: number;
  };
}

export interface KnowledgeGapAnalysisResult {
  knowledge_gaps: Array<{
    missing_topic: string;
    related_graphs: string[];
    related_graph_titles: string[];
    importance: 'high' | 'medium' | 'low';
    suggested_action: 'create' | 'merge' | 'expand';
    reason: string;
  }>;
  analysis_summary: {
    total_gaps: number;
    high_priority_count: number;
  };
}

export const DEFAULT_MODULES: AnalysisModuleState[] = [
  {
    id: 'relations',
    name: '关系发现',
    description: '发现图谱间潜在的关联关系',
    estimatedTime: '5-10秒',
    status: 'idle',
    result: null,
    selected: true,
  },
  {
    id: 'crossDomain',
    name: '跨学科洞察',
    description: '分析跨领域知识交叉点',
    estimatedTime: '5-8秒',
    status: 'idle',
    result: null,
    selected: true,
  },
  {
    id: 'learningPaths',
    name: '学习路径',
    description: '推荐最优学习顺序',
    estimatedTime: '3-5秒',
    status: 'idle',
    result: null,
    selected: true,
  },
  {
    id: 'knowledgeGaps',
    name: '知识缺口',
    description: '识别知识体系中的空白',
    estimatedTime: '3-5秒',
    status: 'idle',
    result: null,
    selected: true,
  },
];
