import { request } from './client';
import type { 
  DiscoveryResult, 
  IntelligentSuggestion,
  GraphRelationType,
  CrossDomainInsight,
  LearningPathSuggestion,
  KnowledgeGap,
} from '@shared/types/graph';

export interface TopicCheckResult {
  is_duplicate: boolean;
  similar_graphs: Array<{
    id: string;
    title: string;
    description?: string;
    similarity: number;
  }>;
}

export interface DomainRecommendation {
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
}

export interface DomainGraphRelation {
  from_title: string;
  to_title: string;
  type: 'prerequisite' | 'extension' | 'related';
  reason?: string;
}

export interface DomainAnalysisResult {
  recommendations: DomainRecommendation[];
  relations: DomainGraphRelation[];
  meta?: {
    requested: number;
    generated: number;
    rounds: number;
  };
}

export interface DomainExpansionResult {
  recommendations: DomainRecommendation[];
  relations: DomainGraphRelation[];
  source_graphs: Array<{
    id: string;
    title: string;
    description?: string;
    domain?: string;
  }>;
}

export interface BatchCreateDomainGraphsResult {
  created: Array<{
    graphId: string;
    title: string;
    isNew: boolean;
  }>;
}

export interface InitializeGraphResult {
  success: boolean;
  taskId: string;
  graphId: string;
  message: string;
}

export interface BatchInitializeResult {
  success: boolean;
  results: Array<{
    graphId: string;
    title: string;
    taskId?: string;
    status: 'pending' | 'skipped';
    reason?: string;
  }>;
  summary: {
    total: number;
    pending: number;
    skipped: number;
  };
}

export const graphsApi = {
  list: () => request('/graphs'),
  
  listTrash: () => request('/graphs/trash'),
  
  getTags: () => request('/graphs/tags'),
  
  getDomains: () => request('/graphs/domains'),
  
  checkTopic: (topic: string, excludeGraphId?: string): Promise<TopicCheckResult> => 
    request('/graphs/check-topic', { 
      method: 'POST', 
      body: JSON.stringify({ topic, exclude_graph_id: excludeGraphId }) 
    }),
  
  create: (data: { title: string; description?: string; domain?: string }) => 
    request('/graphs', { method: 'POST', body: JSON.stringify(data) }),
  
  createFromTemplate: (data: { template_id: string; title?: string; description?: string }) => 
    request('/templates/from-template', { method: 'POST', body: JSON.stringify(data) }),
  
  get: (id: string) => request(`/graphs/${id}`),
  
  getNodes: (id: string) => request(`/graphs/${id}/nodes`),
  
  getNodeStatus: (id: string) => request(`/graphs/${id}/node-status`),
  
  update: (id: string, data: { title?: string; description?: string; domain?: string; settings?: Record<string, unknown> }) => 
    request(`/graphs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  
  togglePublic: (id: string, is_public: boolean) => 
    request(`/graphs/${id}/share`, { method: 'PUT', body: JSON.stringify({ is_public }) }),
  
  toggleFavorite: (id: string, is_favorite: boolean) => 
    request(`/graphs/${id}/favorite`, { method: 'PUT', body: JSON.stringify({ is_favorite }) }),
  
  delete: (id: string) => request(`/graphs/${id}`, { method: 'DELETE' }),
  
  restore: (id: string) => request(`/graphs/${id}/restore`, { method: 'POST' }),
  
  permanentDelete: (id: string) => request(`/graphs/${id}/permanent`, { method: 'DELETE' }),
  
  batchRestore: (ids: string[]) => 
    request('/graphs/batch/restore', { method: 'POST', body: JSON.stringify({ ids }) }),
  
  batchDelete: (ids: string[]) => 
    request('/graphs/batch/delete', { method: 'POST', body: JSON.stringify({ ids }) }),
  
  batchPermanentDelete: (ids: string[]) => 
    request('/graphs/batch/permanent', { method: 'DELETE', body: JSON.stringify({ ids }) }),
  
  getLearningPath: (id: string) => request(`/graphs/${id}/learning-path`),
  
  analyze: (id: string) => request(`/graphs/${id}/analyze`),
  
  getMissingConnections: (id: string, max?: number) => {
    const url = max ? `/graphs/${id}/missing-connections?max=${max}` : `/graphs/${id}/missing-connections`;
    return request(url);
  },
  
  getRelations: (id: string) => request(`/graphs/${id}/relations`),
  
  createPrerequisiteGraph: (id: string, data: { topic: string; description?: string; auto_generate?: boolean }) => 
    request(`/graphs/${id}/prerequisite-graph`, { method: 'POST', body: JSON.stringify(data) }),
  
  createPrerequisiteGraphs: (id: string, data: { 
    topics: Array<{ topic: string; description?: string; mastery_level: string }>;
    depth?: number;
    style?: 'academic' | 'practical' | 'beginner';
  }) => 
    request(`/graphs/${id}/prerequisite-graphs/batch`, { method: 'POST', body: JSON.stringify(data) }),
  
  deleteRelation: (graphId: string, relationId: string) => 
    request(`/graphs/${graphId}/relations/${relationId}`, { method: 'DELETE' }),
  
  getMap: () => request('/graphs/map'),
  
  createRelation: (data: { 
    source_graph_id: string; 
    target_graph_id: string; 
    relation_type: 'prerequisite' | 'extension' | 'related' | 'cross_domain'; 
    context?: string;
  }) => request('/graph-relations/relations', { method: 'POST', body: JSON.stringify(data) }),
  
  deleteRelationById: (relationId: string) => 
    request(`/graph-relations/relations/${relationId}`, { method: 'DELETE' }),
  
  analyzeMap: () => request('/graphs/map/analyze'),
  
  infiniteExpand: (graphId: string, data: {
    max_depth?: number;
    max_graphs_per_level?: number;
    relation_types?: string[];
    auto_generate_nodes?: boolean;
    node_depth?: number;
  }) => request(`/graphs/${graphId}/infinite-expand`, { method: 'POST', body: JSON.stringify(data) }),
  
  analyzeDomain: (domain: string, count: number = 10): Promise<DomainAnalysisResult> => 
    request('/graphs/domain/analyze', { method: 'POST', body: JSON.stringify({ domain, count }) }),
  
  expandDomain: (graphIds: string[], count: number = 10, domain?: string): Promise<DomainExpansionResult> => 
    request('/graphs/domain/expand', { method: 'POST', body: JSON.stringify({ graph_ids: graphIds, count, domain }) }),
  
  batchCreateDomainGraphs: (data: {
    graphs: Array<{
      title: string;
      description?: string;
    }>;
    domain?: string;
    relations?: Array<{
      from_title: string;
      to_title: string;
      type: 'prerequisite' | 'extension' | 'related';
      reason?: string;
    }>;
  }): Promise<BatchCreateDomainGraphsResult> => 
    request('/graphs/domain/batch-create', { method: 'POST', body: JSON.stringify(data) }),
  
  initializeGraph: (graphId: string, style: 'academic' | 'practical' | 'beginner' = 'academic'): Promise<InitializeGraphResult> => 
    request(`/graphs/${graphId}/initialize`, { method: 'POST', body: JSON.stringify({ style }) }),
  
  batchInitializeGraphs: (data: {
    graph_ids: string[];
    style?: 'academic' | 'practical' | 'beginner';
  }): Promise<BatchInitializeResult> => 
    request('/graphs/batch-initialize', { method: 'POST', body: JSON.stringify(data) }),
  
  discoverRelations: (data?: {
    graph_ids?: string[];
    max_suggestions?: number;
    include_cross_domain?: boolean;
  }): Promise<DiscoveryResult> => 
    request('/graphs/discover-relations', { method: 'POST', body: JSON.stringify(data || {}) }),
  
  createDiscoveredRelation: (data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: GraphRelationType;
    context?: string;
    confidence?: number;
    shared_concepts?: string[];
  }): Promise<{ success: boolean; relation_id: string; message: string }> => 
    request('/graphs/create-discovered-relation', { method: 'POST', body: JSON.stringify(data) }),
  
  getIntelligentSuggestions: (graphIds?: string[]): Promise<IntelligentSuggestion> => {
    const url = graphIds && graphIds.length > 0
      ? `/graphs/intelligent-suggestions?graph_ids=${graphIds.join(',')}` 
      : '/graphs/intelligent-suggestions';
    return request(url);
  },

  getCrossDomainInsights: (options?: {
    graph_ids?: string[];
    min_intersection?: number;
  }): Promise<{
    cross_domain_insights: CrossDomainInsight[];
    domain_distribution: Record<string, number>;
    analysis_summary: { total_domains: number; cross_domain_clusters: number };
  }> => 
    request('/graphs/cross-domain-insights', { method: 'POST', body: JSON.stringify(options || {}) }),

  getLearningPathSuggestions: (options?: {
    graph_ids?: string[];
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
  }): Promise<{
    learning_path_suggestions: LearningPathSuggestion[];
    analysis_summary: { total_paths: number; avg_path_length: number };
  }> => 
    request('/graphs/learning-path-suggestions', { method: 'POST', body: JSON.stringify(options || {}) }),

  getKnowledgeGaps: (options?: {
    graph_ids?: string[];
    min_importance?: 'high' | 'medium' | 'low';
  }): Promise<{
    knowledge_gaps: KnowledgeGap[];
    analysis_summary: { total_gaps: number; high_priority_count: number };
  }> => 
    request('/graphs/knowledge-gaps', { method: 'POST', body: JSON.stringify(options || {}) }),
};
