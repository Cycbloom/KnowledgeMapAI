// Inline types for Concept Aggregation API

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

export interface AnalyzeOptions {
  similarityThreshold?: number;
  hierarchyThreshold?: number;
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

export interface IConceptAggregationApi {
  analyze(
    graphId: string,
    options?: AnalyzeOptions,
  ): Promise<{ jobId: string; status: string; message: string }>;

  getResults(graphId: string, jobId?: string): Promise<AnalysisResult>;

  merge(graphId: string, groups: MergeGroup[]): Promise<MergeResult>;

  applyHierarchy(
    graphId: string,
    relations: HierarchyRelationInput[],
  ): Promise<ApplyHierarchyResult>;

  updateAliases(
    knowledgePointId: string,
    aliases: string[],
  ): Promise<UpdateAliasesResult>;
}
