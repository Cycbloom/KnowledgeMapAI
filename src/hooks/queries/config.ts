import { Node, Edge, Task, NodeLevel } from "../../types";

export const DEFAULT_STALE_TIME = 30_000; // 30 秒
export const LONG_STALE_TIME = 1000 * 60 * 30;
export const GC_TIME = 300_000; // 5 分钟

export const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 1,
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
};

export const staticQueryConfig = {
  staleTime: LONG_STALE_TIME,
  gcTime: GC_TIME,
  retry: 1,
};

export const realtimeQueryConfig = {
  // Intentional: always-fresh strategy for realtime queries that must refetch on mount.
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

  // === Scheduler 相关 ===
  // 无参返回短前缀用于 invalidateQueries 前缀匹配;
  // 有参返回完整键用于 useQuery 精确匹配。
  scheduler: () => ["scheduler"] as const,
  schedulerTasks: (filters?: unknown) =>
    filters === undefined
      ? (["scheduler", "tasks"] as const)
      : (["scheduler", "tasks", filters] as const),
  schedulerTask: (id: string) => ["scheduler", "task", id] as const,
  queues: () => ["scheduler", "queues"] as const,
  stats: (period?: string) =>
    period === undefined
      ? (["scheduler", "stats"] as const)
      : (["scheduler", "stats", period] as const),
  heatmap: (year?: number, month?: number) =>
    year === undefined
      ? (["scheduler", "heatmap"] as const)
      : (["scheduler", "heatmap", year, month] as const),
  // Task 7: TaskCard 子任务查询键
  taskSubtasks: (taskId: string) =>
    ["scheduler", "tasks", "subtasks", taskId] as const,

  // === Learning loops 相关 ===
  learningLoops: () => ["learning-loops"] as const,
  activeLearningLoop: () => ["learning-loops", "active"] as const,

  // === GraphMap 相关 ===
  graphMap: () => ["graphMap"] as const,
  domainTree: () => ["domainTree"] as const,

  // === Achievements 相关 ===
  achievements: () => ["achievements"] as const,
  dailyTasks: () => ["daily-tasks"] as const,
  periodicTasks: () => ["periodic-tasks"] as const,
  passProgress: () => ["pass-progress"] as const,

  // === Focus stats 相关 ===
  focusStats: (range?: string) =>
    range === undefined
      ? (["focus-stats"] as const)
      : (["focus-stats", range] as const),

  // === Graph 附加相关 ===
  graphTags: (graphId?: string) =>
    graphId === undefined
      ? (["graphTags"] as const)
      : (["graphTags", graphId] as const),
  graphLearningPath: (graphId: string) =>
    ["graphLearningPath", graphId] as const,
  batchGraphNodeStatus: (ids: string[]) =>
    ["batchGraphNodeStatus", ids.slice().sort().join(",")] as const,

  // === Activities 相关 ===
  activities: (filters?: unknown) =>
    filters === undefined
      ? (["activities"] as const)
      : (["activities", filters] as const),

  // === Study 相关 ===
  studyStats: (graphId: string) => ["studyStats", graphId] as const,
  semanticGroups: (graphId: string) =>
    ["semanticGroups", graphId] as const,

  // === Graph relation 相关 ===
  intelligentSuggestions: (graphIds: string[]) =>
    ["intelligent-suggestions", graphIds] as const,

  // === Trash 相关 ===
  trashGraphs: ["graphs", "trash"] as const,
  trashNotes: ["notes", "trash"] as const,

  // 用于 invalidateQueries 前缀匹配的短键
  notesPrefix: ["notes"] as const,
  tasksPrefix: ["tasks"] as const,
  studyCardsPrefix: ["studyCards"] as const,
  graphNodeStatusPrefix: ["graphNodeStatus"] as const,
  templatesPrefix: ["templates"] as const,

  // === Activities 子查询 ===
  activitiesDaily: (date: string) => ["activities", "daily", date] as const,
  activitiesStats: (startDate: string, endDate: string) =>
    ["activities", "stats", startDate, endDate] as const,

  // === Backlinks 相关 ===
  backlinks: (knowledgePointId: string) =>
    ["backlinks", knowledgePointId] as const,

  // === Calendar 相关 ===
  calendarExecutions: (filters?: unknown) =>
    ["calendar", "executions", filters] as const,

  // === Task 7-11 预留方法 ===
  // Task 8: GlobalSearch 查询键
  search: (query: string) => ["search", query] as const,
  // Task 9: ModularAnalysisPanel 查询键
  modularAnalysis: (graphId: string) =>
    ["modularAnalysis", graphId] as const,
  // Task 11: LearningMode 节点详情查询键
  nodeDetail: (nodeId: string) => ["nodes", "detail", nodeId] as const,
};

export type { Node, Edge, Task, NodeLevel };
