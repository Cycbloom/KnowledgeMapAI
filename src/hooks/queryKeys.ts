/**
 * 分层查询键工厂。
 *
 * 按 domain 组织查询键，每个 domain 下包含 `all`、`list`、`detail(id)` 等方法。
 * 使用 `as const` 确保查询键为字面量类型，提供类型安全。
 *
 * 使用方式：
 * ```ts
 * queryKeys.graphs.all                  // ['graphs']
 * queryKeys.graphs.list(filters)         // ['graphs', 'list', filters]
 * queryKeys.graphs.detail(id)            // ['graphs', 'detail', id]
 * queryKeys.graphs.data(id)              // ['graphs', 'data', id]
 * ```
 */

// ============================================================
// 通用过滤参数类型
// ============================================================

export interface GraphFilters {
  isArchived?: boolean;
  search?: string;
}

export interface NoteListParams {
  type?: string;
  isArchived?: boolean;
  isPinned?: boolean;
  tag?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface StudyCardParams {
  graph_id?: string;
  knowledge_point_id?: string;
  knowledge_point_ids?: string[];
  due?: boolean;
}

export interface ReviewForecastParams {
  graph_id?: string;
  knowledge_point_id?: string;
  knowledge_point_ids?: string[];
}

export interface AIPerformanceLogsQuery {
  limit?: number;
  offset?: number;
  operation?: string;
  provider?: string;
  success?: boolean;
  startTime?: number;
  endTime?: number;
}

export interface AIPerformanceStatsQuery {
  startTime?: number;
  endTime?: number;
}

// ============================================================
// 查询键工厂
// ============================================================

export const queryKeys = {
  // ============================================================
  // Graphs 相关
  // ============================================================
  graphs: {
    /** 图谱列表 */
    all: ["graphs"] as const,
    /** 图谱列表（带筛选） */
    list: (filters?: GraphFilters) =>
      filters === undefined
        ? (["graphs", "list"] as const)
        : (["graphs", "list", filters] as const),
    /** 已删除图谱列表 */
    trash: ["graphs", "trash"] as const,
    /** 单个图谱详情 */
    detail: (id: string) => ["graphs", "detail", id] as const,
    /** 图谱节点+边数据 */
    data: (id: string) => ["graphs", "data", id] as const,
    /** 图谱带 embedding 数据 */
    dataWithEmbedding: (id: string) =>
      ["graphs", "data", "embedding", id] as const,
    /** 节点状态 */
    nodeStatus: (id: string) => ["graphs", "node-status", id] as const,
    /** 批量节点状态 */
    batchNodeStatus: (ids: string[]) =>
      ["graphs", "batch-node-status", ...ids.slice().sort()] as const,
    /** 图谱标签 */
    tags: (graphId?: string) =>
      graphId === undefined
        ? (["graphs", "tags"] as const)
        : (["graphs", "tags", graphId] as const),
    /** 学习路径 */
    learningPath: (graphId: string) =>
      ["graphs", "learning-path", graphId] as const,
    /** 快照列表 */
    snapshots: (graphId: string) =>
      ["graphs", "snapshots", graphId] as const,
    /** 单个快照 */
    snapshot: (graphId: string, snapshotId: string) =>
      ["graphs", "snapshots", graphId, snapshotId] as const,
    /** 快照差异 */
    diff: (graphId: string, sourceId: string, targetId?: string) =>
      targetId === undefined
        ? (["graphs", "diff", graphId, sourceId] as const)
        : (["graphs", "diff", graphId, sourceId, targetId] as const),
    /** 事件列表 */
    events: (graphId: string) => ["graphs", "events", graphId] as const,
    /** 分支列表 */
    branches: (graphId: string) => ["graphs", "branches", graphId] as const,
    /** 合并预览 */
    mergePreview: (graphId: string, branchGraphId: string) =>
      ["graphs", "merge-preview", graphId, branchGraphId] as const,
  },

  // ============================================================
  // Nodes 相关
  // ============================================================
  nodes: {
    /** 节点详情 */
    detail: (nodeId: string) => ["nodes", "detail", nodeId] as const,
  },

  // ============================================================
  // Notes 相关
  // ============================================================
  notes: {
    /** 笔记列表前缀 */
    all: ["notes"] as const,
    /** 笔记列表（带筛选分页） */
    list: (params?: NoteListParams) =>
      [
        "notes",
        "list",
        params?.type ?? "all",
        params?.isArchived ?? false,
        params?.isPinned ?? false,
        params?.tag ?? "all",
        params?.search ?? "",
        params?.page ?? 1,
        params?.pageSize ?? 20,
      ] as const,
    /** 单个笔记详情 */
    detail: (id: string) => ["notes", "detail", id] as const,
    /** 回收站笔记 */
    trash: ["notes", "trash"] as const,
    /** 节点关联笔记 */
    byNode: (nodeId: string) => ["notes", "by-node", nodeId] as const,
    /** 笔记模板列表 */
    templates: () => ["notes", "templates"] as const,
    /** 单块内容 */
    block: (noteId: string, blockId: string) =>
      ["notes", noteId, "blocks", blockId] as const,
    /** 被引用列表 */
    inboundBlockRefs: (noteId: string) =>
      ["notes", noteId, "block-refs", "inbound"] as const,
    /** 引用列表 */
    outboundBlockRefs: (noteId: string) =>
      ["notes", noteId, "block-refs", "outbound"] as const,
    /** 块搜索 */
    blockSearch: (query: string) =>
      ["notes", "block-search", query] as const,
  },

  // ============================================================
  // Backlinks 相关
  // ============================================================
  backlinks: {
    /** 知识点反向链接列表 */
    list: (knowledgePointId: string) =>
      ["backlinks", knowledgePointId] as const,
    /** 节点块引用反向链接 */
    blockRefs: (nodeId: string) =>
      ["backlinks", nodeId, "block-refs"] as const,
  },

  // ============================================================
  // Study 相关
  // ============================================================
  study: {
    /** 学习卡片 */
    cards: (params?: StudyCardParams) =>
      [
        "study",
        "cards",
        params?.graph_id ?? "all",
        params?.knowledge_point_id ?? "all",
        params?.knowledge_point_ids
          ? params.knowledge_point_ids.join(",")
          : "none",
        params?.due ? "due" : "all",
      ] as const,
    /** 复习预测 */
    reviewForecast: (params?: ReviewForecastParams) =>
      [
        "study",
        "review-forecast",
        params?.graph_id ?? "all",
        params?.knowledge_point_id ?? "all",
        params?.knowledge_point_ids
          ? params.knowledge_point_ids.join(",")
          : "none",
      ] as const,
    /** 学习统计 */
    stats: (graphId: string) => ["study", "stats", graphId] as const,
    /** 语义分组 */
    semanticGroups: (graphId: string) =>
      ["study", "semantic-groups", graphId] as const,
  },

  // ============================================================
  // Scheduler 相关
  // ============================================================
  scheduler: {
    /** 调度器前缀 */
    all: () => ["scheduler"] as const,
    /** 任务列表 */
    tasks: (filters?: unknown) =>
      filters === undefined
        ? (["scheduler", "tasks"] as const)
        : (["scheduler", "tasks", filters] as const),
    /** 单个任务 */
    task: (id: string) => ["scheduler", "task", id] as const,
    /** 队列 */
    queues: () => ["scheduler", "queues"] as const,
    /** 统计 */
    stats: (period?: string) =>
      period === undefined
        ? (["scheduler", "stats"] as const)
        : (["scheduler", "stats", period] as const),
    /** 热力图 */
    heatmap: (year?: number, month?: number) =>
      year === undefined
        ? (["scheduler", "heatmap"] as const)
        : (["scheduler", "heatmap", year, month] as const),
    /** 子任务 */
    subtasks: (taskId: string) =>
      ["scheduler", "tasks", "subtasks", taskId] as const,
  },

  // ============================================================
  // Calendar 相关
  // ============================================================
  calendar: {
    /** 日历事件 */
    events: (calendarMode: string, filters?: unknown) =>
      ["calendar", "events", calendarMode, filters] as const,
    /** 执行记录 */
    executions: (filters?: unknown) =>
      ["calendar", "executions", filters] as const,
    /** 活动统计 */
    activityStats: (startDate: string, endDate: string) =>
      ["calendar", "activityStats", startDate, endDate] as const,
    /** 每日活动 */
    dailyActivities: (date: string) =>
      ["calendar", "dailyActivities", date] as const,
  },

  // ============================================================
  // Activities 相关
  // ============================================================
  activities: {
    /** 活动列表 */
    all: (filters?: unknown) =>
      filters === undefined
        ? (["activities"] as const)
        : (["activities", filters] as const),
    /** 每日活动 */
    daily: (date: string) => ["activities", "daily", date] as const,
    /** 活动统计 */
    stats: (startDate: string, endDate: string) =>
      ["activities", "stats", startDate, endDate] as const,
  },

  // ============================================================
  // Auth 相关
  // ============================================================
  auth: {
    /** 当前用户 */
    user: ["auth", "user"] as const,
  },

  // ============================================================
  // AI 相关
  // ============================================================
  ai: {
    /** AI 状态 */
    status: ["ai", "status"] as const,
    /** 性能日志 */
    performanceLogs: (query?: AIPerformanceLogsQuery) =>
      ["ai", "performance", "logs", query] as const,
    /** 性能统计 */
    performanceStats: (query?: AIPerformanceStatsQuery) =>
      ["ai", "performance", "stats", query] as const,
  },

  // ============================================================
  // Dashboard 相关
  // ============================================================
  dashboard: {
    /** 仪表盘统计 */
    stats: ["dashboard", "stats"] as const,
  },

  // ============================================================
  // Statistics 相关
  // ============================================================
  statistics: {
    /** 统计信息 */
    all: ["statistics"] as const,
  },

  // ============================================================
  // Templates 相关
  // ============================================================
  templates: {
    /** 模板列表 */
    all: (category?: string) =>
      ["templates", category ?? "all"] as const,
    /** 单个模板详情 */
    detail: (id: string) => ["templates", "detail", id] as const,
  },

  // ============================================================
  // Tasks 相关（API 任务，非 scheduler 任务）
  // ============================================================
  tasks: {
    /** 任务列表 */
    all: (status?: string, limit?: number, offset?: number) =>
      ["tasks", status ?? "all", limit ?? 20, offset ?? 0] as const,
  },

  // ============================================================
  // Learning Loops 相关
  // ============================================================
  learningLoops: {
    /** 学习循环列表 */
    all: () => ["learning-loops"] as const,
    /** 活跃学习循环 */
    active: () => ["learning-loops", "active"] as const,
  },

  // ============================================================
  // Graph Map 相关
  // ============================================================
  graphMap: {
    /** 图谱地图 */
    all: () => ["graphMap"] as const,
    /** 领域树 */
    domainTree: () => ["domainTree"] as const,
  },

  // ============================================================
  // Achievements 相关
  // ============================================================
  achievements: {
    /** 成就列表 */
    all: () => ["achievements"] as const,
    /** 每日任务 */
    dailyTasks: () => ["daily-tasks"] as const,
    /** 周期性任务 */
    periodicTasks: () => ["periodic-tasks"] as const,
    /** 通关进度 */
    passProgress: () => ["pass-progress"] as const,
  },

  // ============================================================
  // Focus Stats 相关
  // ============================================================
  focusStats: {
    /** 专注统计 */
    all: (range?: string) =>
      range === undefined
        ? (["focus-stats"] as const)
        : (["focus-stats", range] as const),
  },

  // ============================================================
  // Search 相关
  // ============================================================
  search: {
    /** 全局搜索 */
    all: (query: string) => ["search", query] as const,
  },

  // ============================================================
  // Modular Analysis 相关
  // ============================================================
  modularAnalysis: {
    /** 模块化分析 */
    all: (graphId: string) => ["modularAnalysis", graphId] as const,
  },

  // ============================================================
  // Intelligent Suggestions 相关
  // ============================================================
  intelligentSuggestions: {
    /** 智能建议 */
    all: (graphIds: string[]) =>
      ["intelligent-suggestions", graphIds] as const,
  },

  // ============================================================
  // Settings 相关
  // ============================================================
  settings: {
    /** 设置 */
    all: () => ["settings"] as const,
  },
};