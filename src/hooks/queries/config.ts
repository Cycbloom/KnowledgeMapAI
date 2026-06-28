import { Node, Edge, Task, NodeLevel } from "../../types";

export const DEFAULT_STALE_TIME = 1000 * 60 * 5;
export const LONG_STALE_TIME = 1000 * 60 * 30;
export const GC_TIME = 1000 * 60 * 60;

export const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 2,
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
};

export const staticQueryConfig = {
  staleTime: LONG_STALE_TIME,
  gcTime: GC_TIME,
  retry: 1,
};

export const realtimeQueryConfig = {
  staleTime: 0,
  gcTime: GC_TIME,
  retry: 1,
};

export const queryKeys = {
  graphs: ["graphs"] as const,
  graph: (id: string) => ["graph", id] as const,
  graphData: (id: string) => ["graphData", id] as const,
  graphDataWithEmbedding: (id: string) => ["graphDataWithEmbedding", id] as const,
  graphNodeStatus: (id: string) => ["graphNodeStatus", id] as const,
  studyCards: (params?: {
    graph_id?: string;
    knowledge_point_id?: string;
    knowledge_point_ids?: string[];
    due?: boolean;
  }) =>
    [
      "studyCards",
      params?.graph_id || "all",
      params?.knowledge_point_id || "all",
      params?.knowledge_point_ids
        ? params.knowledge_point_ids.join(",")
        : "none",
      params?.due ? "due" : "all",
    ] as const,
  user: ["user"] as const,
  dashboardStats: ["dashboardStats"] as const,
  tasks: (status?: string, limit?: number, offset?: number) =>
    ["tasks", status || "all", limit || 20, offset || 0] as const,
  aiStatus: ["aiStatus"] as const,
  statistics: ["statistics"] as const,
  templates: (category?: string) => ["templates", category || "all"] as const,
  template: (id: string) => ["template", id] as const,
  graphSnapshots: (graphId: string) => ["graphSnapshots", graphId] as const,
  graphSnapshot: (graphId: string, snapshotId: string) =>
    ["graphSnapshot", graphId, snapshotId] as const,
  graphDiff: (graphId: string, sourceId: string, targetId?: string) =>
    ["graphDiff", graphId, sourceId, targetId] as const,
  graphEvents: (graphId: string) => ["graphEvents", graphId] as const,
  graphBranches: (graphId: string) =>
    ["graphBranches", graphId] as const,
  graphMergePreview: (graphId: string, branchGraphId: string) =>
    ["graphMergePreview", graphId, branchGraphId] as const,
  aiPerformanceLogs: (query?: {
    limit?: number;
    offset?: number;
    operation?: string;
    provider?: string;
    success?: boolean;
    startTime?: number;
    endTime?: number;
  }) => ["aiPerformanceLogs", query] as const,
  aiPerformanceStats: (query?: {
    startTime?: number;
    endTime?: number;
  }) => ["aiPerformanceStats", query] as const,
};

export type { Node, Edge, Task, NodeLevel };
