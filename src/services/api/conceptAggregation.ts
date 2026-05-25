import { request } from "./client";

export interface ConceptGroup {
  id: string;
  targetId: string;
  targetTitle: string;
  sourceIds: string[];
  sourceTitles: string[];
  similarity: number;
  suggestedMergeTitle?: string;
}

export interface HierarchyRelation {
  parentId: string;
  parentTitle: string;
  childId: string;
  childTitle: string;
  confidence: number;
  reason?: string;
}

export interface AnalysisResult {
  jobId: string;
  status: "pending" | "processing" | "completed" | "failed";
  progress?: number;
  groups?: ConceptGroup[];
  hierarchyRelations?: HierarchyRelation[];
  summary?: {
    totalNodes: number;
    groupCount: number;
    hierarchyCount: number;
    avgSimilarity: number;
  };
  error?: string;
}

export interface AnalyzeOptions {
  similarityThreshold?: number;
  hierarchyThreshold?: number;
}

export interface MergeGroup {
  targetId: string;
  sourceIds: string[];
}

export interface MergeResult {
  mergedCount: number;
  upgradedNodes: Array<{
    id: string;
    title: string;
    mergedFrom: string[];
  }>;
}

export interface HierarchyRelationInput {
  parentId: string;
  childId: string;
}

export interface ApplyHierarchyResult {
  appliedCount: number;
  failedCount: number;
  failedRelations?: Array<{
    relation: HierarchyRelationInput;
    reason: string;
  }>;
}

export interface UpdateAliasesResult {
  success: boolean;
  aliases: string[];
}

export const conceptAggregationApi = {
  analyze: (
    graphId: string,
    options?: AnalyzeOptions,
  ): Promise<{ jobId: string; status: string; message: string }> =>
    request(`/graphs/${graphId}/concept-aggregation/analyze`, {
      method: "POST",
      body: JSON.stringify(options ?? {}),
    }),

  getResults: (graphId: string, jobId?: string): Promise<AnalysisResult> => {
    const params = jobId ? `?jobId=${jobId}` : "";
    return request<AnalysisResult>(
      `/graphs/${graphId}/concept-aggregation/results${params}`,
      { method: "GET" },
    );
  },

  merge: (
    graphId: string,
    groups: MergeGroup[],
  ): Promise<MergeResult> =>
    request(`/graphs/${graphId}/concept-aggregation/merge`, {
      method: "POST",
      body: JSON.stringify({ groups }),
    }),

  applyHierarchy: (
    graphId: string,
    relations: HierarchyRelationInput[],
  ): Promise<ApplyHierarchyResult> =>
    request(`/graphs/${graphId}/concept-aggregation/hierarchy`, {
      method: "POST",
      body: JSON.stringify({ relations }),
    }),

  updateAliases: (
    knowledgePointId: string,
    aliases: string[],
  ): Promise<UpdateAliasesResult> =>
    request<{ success: boolean; aliases: string[] }>(
      `/knowledge-points/${knowledgePointId}/aliases`,
      {
        method: "PUT",
        body: JSON.stringify({ aliases }),
      },
    ),
};
