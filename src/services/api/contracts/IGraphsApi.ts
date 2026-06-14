import type {
  Graph,
  Node,
  Edge,
  NodeStatus,
  GraphRelationType,
  DiscoveryResult,
  IntelligentSuggestion,
  CrossDomainInsight,
  LearningPathSuggestion,
  KnowledgeGap,
  CreateGraphFromTemplateData,
  GraphMapData,
  GraphRelation,
} from "@shared/types";
import type { CreateGraphData, UpdateGraphData } from "@shared/types/api";
import type {
  TopicCheckResult,
  DomainAnalysisResult,
  DomainExpansionResult,
  BatchCreateDomainGraphsResult,
  InitializeGraphResult,
  BatchInitializeResult,
} from "./graphTypes";

export interface GraphAnalysis {
  nodeCount: number;
  edgeCount: number;
  isolatedNodes: string[];
  disconnectedComponents: number;
  maxDepth: number;
  avgDepth: number;
  levelDistribution: Record<string, number>;
  avgDegree: number;
  maxDegree: number;
  minDegree: number;
  centralNodes: Array<{ id: string; degree: number; title: string }>;
  rootNodes: string[];
  leafNodes: string[];
  nodesWithoutContent: string[];
  nodesWithManyChildren: Array<{ id: string; childrenCount: number; title: string }>;
  healthScore: number;
  healthIssues: string[];
}

export interface IGraphsApi {
  list(): Promise<Graph[]>;

  listTrash(): Promise<Graph[]>;

  getTags(): Promise<string[]>;

  getDomains(): Promise<{ domains: Array<{ name: string; count: number }> }>;

  checkTopic(topic: string, excludeGraphId?: string): Promise<TopicCheckResult>;

  create(data: CreateGraphData): Promise<Graph>;

  createFromTemplate(data: CreateGraphFromTemplateData): Promise<Graph>;

  get(id: string): Promise<Graph>;

  getNodes(id: string): Promise<{ nodes: Node[]; edges: Edge[] }>;

  getNodeStatus(id: string): Promise<Record<string, NodeStatus>>;

  update(id: string, data: UpdateGraphData): Promise<Graph>;

  togglePublic(id: string, is_public: boolean): Promise<Graph>;

  toggleFavorite(id: string, is_favorite: boolean): Promise<Graph>;

  updateViewMode(id: string, viewMode: string): Promise<Graph>;

  delete(id: string): Promise<void>;

  restore(id: string): Promise<Graph>;

  permanentDelete(id: string): Promise<void>;

  batchRestore(ids: string[]): Promise<{ count: number }>;

  batchDelete(ids: string[]): Promise<{ count: number }>;

  batchPermanentDelete(ids: string[]): Promise<{ count: number }>;

  getLearningPath(id: string): Promise<unknown[]>;

  analyze(id: string): Promise<GraphAnalysis>;

  getLiterature(
    id: string,
    module?: string,
  ): Promise<{
    literature: Array<{
      title: string;
      authors: string[];
      year: number;
      type: string;
      url: string;
      conceptCount: number;
      modules: string[];
    }>;
    totalCount: number;
  }>;

  getResearchProgress(id: string): Promise<{
    modules: Array<{
      module_type: string;
      title: string;
      icon: string;
      color: string;
      nodeCount: number;
      literatureCount: number;
    }>;
    totalNodes: number;
    totalLiterature: number;
  }>;

  getModuleGaps(id: string): Promise<{
    needsNewModule: boolean;
    suggestedModules: Array<{ name: string; reason: string }>;
    unclassifiedCount: number;
  }>;

  getModuleOverlap(id: string): Promise<{
    overlaps: Array<{
      module1: string;
      module2: string;
      similarity: number;
    }>;
  }>;

  getMissingConnections(id: string, max?: number): Promise<{ suggestions: Array<{ sourceId: string; targetId: string; reason: string }> }>;

  getRelations(id: string): Promise<{
    prerequisites: GraphRelation[];
    extensions: GraphRelation[];
    related: GraphRelation[];
  }>;

  createPrerequisiteGraph(
    id: string,
    data: { topic: string; description?: string; auto_generate?: boolean },
  ): Promise<{ graph_id: string; title: string }>;

  createPrerequisiteGraphs(
    id: string,
    data: {
      topics: Array<{
        topic: string;
        description?: string;
        mastery_level: string;
      }>;
      depth?: number;
      style?: "academic" | "practical" | "beginner";
    },
  ): Promise<{ graph_ids: string[] }>;

  deleteRelation(graphId: string, relationId: string): Promise<void>;

  getMap(): Promise<GraphMapData>;

  createRelation(data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: "prerequisite" | "extension" | "related" | "cross_domain";
    context?: string;
  }): Promise<unknown>;

  deleteRelationById(relationId: string): Promise<void>;

  infiniteExpand(
    graphId: string,
    data: {
      max_depth?: number;
      max_graphs_per_level?: number;
      relation_types?: string[];
      auto_generate_nodes?: boolean;
      node_depth?: number;
    },
  ): Promise<unknown>;

  analyzeDomain(
    domain: string,
    count?: number,
    sessionId?: string,
  ): Promise<DomainAnalysisResult>;

  expandDomain(
    graphIds: string[],
    count?: number,
    domain?: string,
  ): Promise<DomainExpansionResult>;

  batchCreateDomainGraphs(data: {
    graphs: Array<{
      title: string;
      description?: string;
    }>;
    domain?: string;
    relations?: Array<{
      from_title: string;
      to_title: string;
      type: "prerequisite" | "extension" | "related";
      reason?: string;
    }>;
  }): Promise<BatchCreateDomainGraphsResult>;

  initializeGraph(
    graphId: string,
    style?: "academic" | "practical" | "beginner",
  ): Promise<InitializeGraphResult>;

  batchInitializeGraphs(data: {
    graph_ids: string[];
    style?: "academic" | "practical" | "beginner";
    session_id?: string;
  }): Promise<BatchInitializeResult>;

  discoverRelations(data?: {
    graph_ids?: string[];
    max_suggestions?: number;
    include_cross_domain?: boolean;
  }): Promise<DiscoveryResult>;

  createDiscoveredRelation(data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: GraphRelationType;
    context?: string;
    confidence?: number;
    shared_concepts?: string[];
  }): Promise<{ success: boolean; relation_id: string; message: string }>;

  getIntelligentSuggestions(
    graphIds?: string[],
  ): Promise<IntelligentSuggestion>;

  getCrossDomainInsights(options?: {
    graph_ids?: string[];
    min_intersection?: number;
  }): Promise<{
    cross_domain_insights: CrossDomainInsight[];
    domain_distribution: Record<string, number>;
    analysis_summary: { total_domains: number; cross_domain_clusters: number };
  }>;

  getLearningPathSuggestions(options?: {
    graph_ids?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
  }): Promise<{
    learning_path_suggestions: LearningPathSuggestion[];
    analysis_summary: { total_paths: number; avg_path_length: number };
  }>;

  getKnowledgeGaps(options?: {
    graph_ids?: string[];
    min_importance?: "high" | "medium" | "low";
  }): Promise<{
    knowledge_gaps: KnowledgeGap[];
    analysis_summary: { total_gaps: number; high_priority_count: number };
  }>;
}