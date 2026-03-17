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
  staleTime: 5000,
  gcTime: GC_TIME,
  retry: 1,
};

export const queryKeys = {
  graphs: ["graphs"] as const,
  graph: (id: string) => ["graph", id] as const,
  graphData: (id: string) => ["graphData", id] as const,
  graphNodeStatus: (id: string) => ["graphNodeStatus", id] as const,
  studyCards: (params?: {
    graph_id?: string;
    node_id?: string;
    node_ids?: string;
    due?: boolean;
  }) =>
    [
      "studyCards",
      params?.graph_id || "all",
      params?.node_id || "all",
      params?.node_ids || "none",
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
  scheduler: {
    tasks: (filters?: Record<string, unknown>) =>
      ["scheduler", "tasks", filters] as const,
    task: (id: string) => ["scheduler", "task", id] as const,
    queues: () => ["scheduler", "queues"] as const,
    executions: (filters?: Record<string, unknown>) =>
      ["scheduler", "executions", filters] as const,
    settings: () => ["scheduler", "settings"] as const,
    stats: (period: string) => ["scheduler", "stats", period] as const,
    heatmap: (year?: number, month?: number) =>
      ["scheduler", "heatmap", year, month] as const,
    focusSessions: (options?: Record<string, unknown>) =>
      ["scheduler", "focusSessions", options] as const,
    achievements: () => ["scheduler", "achievements"] as const,
    userAchievements: () => ["scheduler", "userAchievements"] as const,
  },
};
