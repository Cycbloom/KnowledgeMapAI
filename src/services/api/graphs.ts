import { request } from "./client";
import type {
  Graph,
  Node,
  Edge,
  NodeStatus,
  DiscoveryResult,
  IntelligentSuggestion,
  GraphRelationType,
  CrossDomainInsight,
  LearningPathSuggestion,
  KnowledgeGap,
  CreateGraphFromTemplateData,
  GraphMapData,
  GraphRelation,
  NodeRelationSuggestion,
} from "@shared/types/graph";
import type {
  CreateGraphData,
  UpdateGraphData,
} from "@shared/types/api";
import type { IGraphsApi, GraphAnalysis } from "./contracts/IGraphsApi";
import type {
  TopicCheckResult,
  DomainAnalysisResult,
  DomainExpansionResult,
  BatchCreateDomainGraphsResult,
  InitializeGraphResult,
  BatchInitializeResult,
} from "./contracts/graphTypes";

export type {
  TopicCheckResult,
  DomainRecommendation,
  DomainGraphRelation,
  DomainAnalysisResult,
  DomainExpansionResult,
  BatchCreateDomainGraphsResult,
  InitializeGraphResult,
  BatchInitializeResult,
} from "./contracts/graphTypes";

export const graphsApi: IGraphsApi = {
  list: () => request<Graph[]>("/graphs"),

  listTrash: () => request<Graph[]>("/graphs/trash"),

  getTags: () =>
    request<{ tags: Array<{ name: string; count: number }> }>(
      "/graphs/tags",
    ),

  getDomains: () =>
    request<{ domains: Array<{ name: string; count: number }> }>(
      "/graphs/domains",
    ),

  checkTopic: (
    topic: string,
    excludeGraphId?: string,
  ): Promise<TopicCheckResult> =>
    request<TopicCheckResult>("/graphs/check-topic", {
      method: "POST",
      body: JSON.stringify({ topic, exclude_graph_id: excludeGraphId }),
    }),

  create: (data: CreateGraphData) =>
    request<Graph>("/graphs", { method: "POST", body: JSON.stringify(data) }),

  createFromTemplate: (data: CreateGraphFromTemplateData) =>
    request<Graph>("/templates/from-template", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  get: (id: string) => request<Graph>(`/graphs/${id}`),

  getNodes: (id: string, includeEmbedding?: boolean, includeStatus?: boolean) => {
    const params = new URLSearchParams();
    if (includeEmbedding) params.set("includeEmbedding", "true");
    if (includeStatus) params.set("includeStatus", "true");
    const query = params.toString();
    return request<{ nodes: Node[]; edges: Edge[]; nodeStatus?: Record<string, NodeStatus> }>(
      `/graphs/${id}/nodes${query ? `?${query}` : ""}`,
    );
  },

  getNodeStatus: (id: string) =>
    request<Record<string, NodeStatus>>(`/graphs/${id}/node-status`),

  batchGetNodeStatus: (graphIds: string[]) =>
    request<Record<string, Record<string, NodeStatus>>>(
      "/graphs/batch-node-status",
      {
        method: "POST",
        body: JSON.stringify({ graph_ids: graphIds }),
      },
    ),

  update: (id: string, data: UpdateGraphData) =>
    request<Graph>(`/graphs/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  togglePublic: (id: string, is_public: boolean) =>
    request<Graph>(`/graphs/${id}/share`, {
      method: "PUT",
      body: JSON.stringify({ is_public }),
    }),

  toggleFavorite: (id: string, is_favorite: boolean) =>
    request<Graph>(`/graphs/${id}/favorite`, {
      method: "PUT",
      body: JSON.stringify({ is_favorite }),
    }),

  updateViewMode: (id: string, viewMode: string) =>
    request<Graph>(`/graphs/${id}/view-mode`, {
      method: "PUT",
      body: JSON.stringify({ viewMode }),
    }),

  delete: (id: string) =>
    request<void>(`/graphs/${id}`, { method: "DELETE" }),

  restore: (id: string) =>
    request<Graph>(`/graphs/${id}/restore`, { method: "POST" }),

  permanentDelete: (id: string) =>
    request<void>(`/graphs/${id}/permanent`, { method: "DELETE" }),

  batchRestore: (ids: string[]) =>
    request<{ count: number }>("/graphs/batch/restore", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  batchDelete: (ids: string[]) =>
    request<{ count: number }>("/graphs/batch/delete", {
      method: "POST",
      body: JSON.stringify({ ids }),
    }),

  batchPermanentDelete: (ids: string[]) =>
    request<{ count: number }>("/graphs/batch/permanent", {
      method: "DELETE",
      body: JSON.stringify({ ids }),
    }),

  getLearningPath: (id: string) =>
    request<unknown[]>(`/graphs/${id}/learning-path`),

  analyze: (id: string) => request<GraphAnalysis>(`/graphs/${id}/analyze`),

  getLiterature: (id: string, module?: string) => {
    const params = module ? `?module=${encodeURIComponent(module)}` : "";
    return request<{
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
    }>(`/graphs/${id}/literature${params}`);
  },

  getModuleGaps: (id: string) =>
    request<{
      needsNewModule: boolean;
      suggestedModules: Array<{ name: string; reason: string }>;
      unclassifiedCount: number;
    }>(`/graphs/${id}/analysis/module-gaps`),

  getModuleOverlap: (id: string) =>
    request<{
      overlaps: Array<{
        module1: string;
        module2: string;
        similarity: number;
      }>;
    }>(`/graphs/${id}/analysis/module-overlap`),

  getMissingConnections: (id: string, max?: number): Promise<{
    suggestions: Array<{ sourceId: string; targetId: string; reason: string }>;
  }> => {
    const url = max
      ? `/graphs/${id}/missing-connections?max=${max}`
      : `/graphs/${id}/missing-connections`;
    return request<{
      suggestions: Array<{ sourceId: string; targetId: string; reason: string }>;
    }>(url);
  },

  getRelations: (id: string): Promise<{
    prerequisites: GraphRelation[];
    extensions: GraphRelation[];
    related: GraphRelation[];
  }> =>
    request<{
      prerequisites: GraphRelation[];
      extensions: GraphRelation[];
      related: GraphRelation[];
    }>(`/graphs/${id}/relations`),

  createPrerequisiteGraph: (
    id: string,
    data: { topic: string; description?: string; auto_generate?: boolean },
  ): Promise<{ graph_id: string; title: string }> =>
    request<{ graph_id: string; title: string }>(
      `/graphs/${id}/prerequisite-graph`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  createPrerequisiteGraphs: (
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
  ): Promise<{ graph_ids: string[] }> =>
    request<{ graph_ids: string[] }>(
      `/graphs/${id}/prerequisite-graphs/batch`,
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  deleteRelation: (graphId: string, relationId: string): Promise<void> =>
    request<void>(`/graphs/${graphId}/relations/${relationId}`, {
      method: "DELETE",
    }),

  getMap: (): Promise<GraphMapData> => request<GraphMapData>("/graphs/map"),

  createRelation: (data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: "prerequisite" | "extension" | "related" | "cross_domain";
    context?: string;
  }): Promise<unknown> =>
    request<unknown>("/graph-relations/relations", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  deleteRelationById: (relationId: string): Promise<void> =>
    request<void>(`/graph-relations/relations/${relationId}`, {
      method: "DELETE",
    }),

  infiniteExpand: (
    graphId: string,
    data: {
      max_depth?: number;
      max_graphs_per_level?: number;
      relation_types?: string[];
      auto_generate_nodes?: boolean;
      node_depth?: number;
    },
  ): Promise<unknown> =>
    request<unknown>(`/graphs/${graphId}/infinite-expand`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  analyzeDomain: (
    domain: string,
    count: number = 10,
    sessionId?: string,
  ): Promise<DomainAnalysisResult> =>
    request<DomainAnalysisResult>("/graphs/domain/analyze", {
      method: "POST",
      body: JSON.stringify({ domain, count, session_id: sessionId }),
    }),

  expandDomain: (
    graphIds: string[],
    count: number = 10,
    domain?: string,
  ): Promise<DomainExpansionResult> =>
    request<DomainExpansionResult>("/graphs/domain/expand", {
      method: "POST",
      body: JSON.stringify({ graph_ids: graphIds, count, domain }),
    }),

  batchCreateDomainGraphs: (data: {
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
  }): Promise<BatchCreateDomainGraphsResult> =>
    request<BatchCreateDomainGraphsResult>("/graphs/domain/batch-create", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  initializeGraph: (
    graphId: string,
    style: "academic" | "practical" | "beginner" = "academic",
  ): Promise<InitializeGraphResult> =>
    request<InitializeGraphResult>(`/graphs/${graphId}/initialize`, {
      method: "POST",
      body: JSON.stringify({ style }),
    }),

  batchInitializeGraphs: (data: {
    graph_ids: string[];
    style?: "academic" | "practical" | "beginner";
    session_id?: string;
  }): Promise<BatchInitializeResult> =>
    request<BatchInitializeResult>("/graphs/batch-initialize", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  discoverRelations: (data?: {
    graph_ids?: string[];
    max_suggestions?: number;
    include_cross_domain?: boolean;
  }): Promise<DiscoveryResult> =>
    request<DiscoveryResult>("/graphs/discover-relations", {
      method: "POST",
      body: JSON.stringify(data || {}),
    }),

  createDiscoveredRelation: (data: {
    source_graph_id: string;
    target_graph_id: string;
    relation_type: GraphRelationType;
    context?: string;
    confidence?: number;
    shared_concepts?: string[];
  }): Promise<{ success: boolean; relation_id: string; message: string }> =>
    request<{ success: boolean; relation_id: string; message: string }>(
      "/graphs/create-discovered-relation",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    ),

  getIntelligentSuggestions: (
    graphIds?: string[],
  ): Promise<IntelligentSuggestion> => {
    const url =
      graphIds && graphIds.length > 0
        ? `/graphs/intelligent-suggestions?graph_ids=${graphIds.join(",")}`
        : "/graphs/intelligent-suggestions";
    return request<IntelligentSuggestion>(url);
  },

  getCrossDomainInsights: (options?: {
    graph_ids?: string[];
    min_intersection?: number;
  }): Promise<{
    cross_domain_insights: CrossDomainInsight[];
    domain_distribution: Record<string, number>;
    analysis_summary: { total_domains: number; cross_domain_clusters: number };
  }> =>
    request<{
      cross_domain_insights: CrossDomainInsight[];
      domain_distribution: Record<string, number>;
      analysis_summary: { total_domains: number; cross_domain_clusters: number };
    }>("/graphs/cross-domain-insights", {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  getLearningPathSuggestions: (options?: {
    graph_ids?: string[];
    difficulty?: "beginner" | "intermediate" | "advanced";
  }): Promise<{
    learning_path_suggestions: LearningPathSuggestion[];
    analysis_summary: { total_paths: number; avg_path_length: number };
  }> =>
    request<{
      learning_path_suggestions: LearningPathSuggestion[];
      analysis_summary: { total_paths: number; avg_path_length: number };
    }>("/graphs/learning-path-suggestions", {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  getKnowledgeGaps: (options?: {
    graph_ids?: string[];
    min_importance?: "high" | "medium" | "low";
  }): Promise<{
    knowledge_gaps: KnowledgeGap[];
    analysis_summary: { total_gaps: number; high_priority_count: number };
  }> =>
    request<{
      knowledge_gaps: KnowledgeGap[];
      analysis_summary: { total_gaps: number; high_priority_count: number };
    }>("/graphs/knowledge-gaps", {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  applyNodeRelations: (
    graphId: string,
    suggestions: NodeRelationSuggestion[],
  ): Promise<{
    applied: number;
    skipped: Array<{ source_id: string; target_id: string; reason: string }>;
  }> =>
    request<{
      applied: number;
      skipped: Array<{ source_id: string; target_id: string; reason: string }>;
    }>(`/graphs/${graphId}/apply-node-relations`, {
      method: "POST",
      body: JSON.stringify({ suggestions }),
    }),
};
