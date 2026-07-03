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
  reviewForecast: (params?: {
    graph_id?: string;
    knowledge_point_id?: string;
    knowledge_point_ids?: string[];
  }) =>
    [
      "reviewForecast",
      params?.graph_id || "all",
      params?.knowledge_point_id || "all",
      params?.knowledge_point_ids
        ? params.knowledge_point_ids.join(",")
        : "none",
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
  notes: (params?: {
    type?: string;
    isArchived?: boolean;
    isPinned?: boolean;
    tag?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }) =>
    [
      "notes",
      params?.type ?? "all",
      params?.isArchived ?? false,
      params?.isPinned ?? false,
      params?.tag ?? "all",
      params?.search ?? "",
      params?.page ?? 1,
      params?.pageSize ?? 20,
    ] as const,
  // 单笔记详情：以 ["notes", "detail", id] 为键，可被 ["notes"] 前缀失效
  note: (id: string) => ["notes", "detail", id] as const,
  // 节点详情"关联笔记"：以 ["notes", "by-node", nodeId] 为键，可被 ["notes"] 前缀失效
  notesByNode: (nodeId: string) => ["notes", "by-node", nodeId] as const,
  // P1 Task 11: 笔记模板列表。模板变更会影响下次 daily 自动创建,故以
  // ["notes", "templates"] 为键的同时被 ["notes"] 前缀失效。
  noteTemplates: () => ["notes", "templates"] as const,
  // P3: 块引用/块嵌入相关查询键
  // 单块内容:以 ["notes", noteId, "blocks", blockId] 为键,可被 ["notes", noteId] 前缀失效
  noteBlock: (noteId: string, blockId: string) =>
    ["notes", noteId, "blocks", blockId] as const,
  // 被引用列表:以 ["notes", noteId, "block-refs", "inbound"] 为键
  noteInboundBlockRefs: (noteId: string) =>
    ["notes", noteId, "block-refs", "inbound"] as const,
  // 引用列表:以 ["notes", noteId, "block-refs", "outbound"] 为键
  noteOutboundBlockRefs: (noteId: string) =>
    ["notes", noteId, "block-refs", "outbound"] as const,
  // 块搜索补全:以 ["notes", "block-search", query] 为键
  noteBlockSearch: (query: string) =>
    ["notes", "block-search", query] as const,
  // P3:节点详情"引用此节点的块":以 ["backlinks", nodeId, "block-refs"] 为键
  // 独立前缀,避免被 ["notes"] 前缀失效误清(节点详情数据不随笔记列表变更而变)
  nodeBlockRefBacklinks: (nodeId: string) =>
    ["backlinks", nodeId, "block-refs"] as const,
};

export type { Node, Edge, Task, NodeLevel };
