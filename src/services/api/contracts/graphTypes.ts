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
  priority: "high" | "medium" | "low";
}

export interface DomainGraphRelation {
  from_title: string;
  to_title: string;
  type: "prerequisite" | "extension" | "related";
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
  failed?: Array<{
    title: string;
    error: string;
    reason: string;
  }>;
  summary?: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
  };
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
    status: "pending" | "skipped";
    reason?: string;
  }>;
  summary: {
    total: number;
    pending: number;
    skipped: number;
  };
}