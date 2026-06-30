// 图谱发现与推荐相关类型
// GraphRelation, GraphMapData, DiscoveredRelation, IntelligentSuggestion, GraphRecommendation 等

import type {
  GraphRelationType,
  LearningOrder,
  RelationSource,
} from "./graph-core";
import type { Graph } from "./graph-entity";

export interface GraphRelation {
  id: string;
  source_graph_id: string;
  target_graph_id: string;
  relation_type: GraphRelationType;
  context?: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
  source?: RelationSource;
  shared_concepts?: string[];
  created_at: string;
  source_graph?: Graph | Graph[];
  target_graph?: Graph | Graph[];
}

export interface GraphMapData {
  graphs: Array<Graph & { node_count?: number }>;
  relations: GraphRelation[];
}

export type GraphMapFilterMode =
  | "all"
  | "prerequisite"
  | "extension"
  | "related";

export const GRAPH_RELATION_COLORS: Record<GraphRelationType, string> = {
  prerequisite: "#3B82F6",
  extension: "#10B981",
  related: "#F59E0B",
  cross_domain: "#8B5CF6",
};

export const GRAPH_RELATION_LABELS: Record<GraphRelationType, string> = {
  prerequisite: "前置知识",
  extension: "扩展知识",
  related: "相关知识",
  cross_domain: "跨学科",
};

export interface DiscoveredRelation {
  source_graph_id: string;
  source_graph_title: string;
  target_graph_id: string;
  target_graph_title: string;
  relation_type: GraphRelationType;
  confidence: number;
  reason: string;
  shared_concepts: string[];
  suggested_learning_order?: LearningOrder;
}

export interface CrossDomainInsight {
  domains: string[];
  intersection_topics: string[];
  description: string;
  related_graph_ids: string[];
}

export interface DiscoveryResult {
  discovered_relations: DiscoveredRelation[];
  cross_domain_insights: CrossDomainInsight[];
  analysis_summary: {
    total_graphs_analyzed: number;
    relations_discovered: number;
    cross_domain_clusters: number;
    isolated_graphs: string[];
  };
}

export interface LearningPathSuggestion {
  path: string[];
  description: string;
  estimated_time: string;
  difficulty: "beginner" | "intermediate" | "advanced";
}

export interface KnowledgeGap {
  missing_topic: string;
  related_graphs: string[];
  importance: "high" | "medium" | "low";
  suggested_action: "create" | "merge" | "expand";
}

export interface CrossDomainOpportunity {
  domains: string[];
  intersection_graphs: string[];
  potential_benefits: string;
  recommended_order: string[];
}

export interface IntelligentSuggestion {
  learning_path_suggestions: LearningPathSuggestion[];
  knowledge_gaps: KnowledgeGap[];
  cross_domain_opportunities: CrossDomainOpportunity[];
}

export interface GraphRecommendation {
  graph_id: string;
  graph_title: string;
  recommendation_type: GraphRelationType;
  confidence: number;
  reason: string;
}
