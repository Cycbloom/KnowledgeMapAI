import { request, getAIConfig } from "./client";
import { getAILanguage } from "@/hooks/ai/useAILanguage";
import { createStreamHandler } from "../shared/streamHandler";

export type LearningPathStatus = "active" | "completed" | "paused" | "archived";
export type NodeStatus = "pending" | "in_progress" | "completed" | "skipped";
export type GoalType = "natural_language" | "graph_node" | "template";

/**
 * 学习路径节点（后端 learning_path_nodes 表结构）
 */
export interface LearningPathNodeResponse {
  id: string;
  path_id: string;
  knowledge_point_id?: string;
  graph_id?: string;
  order_index: number;
  title: string;
  description?: string;
  estimated_time: number;
  is_milestone: boolean;
  prerequisites: string[];
  status: NodeStatus;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 学习路径进度概览（后端 LearningPathProgressSummary 结构）
 */
export interface LearningPathProgressSummary {
  total_nodes: number;
  completed_nodes: number;
  in_progress_nodes: number;
  pending_nodes: number;
  skipped_nodes: number;
  total_time_spent: number;
  progress_percentage: number;
}

/**
 * 学习路径（后端 LearningPath 结构，含可选 nodes/progress）
 */
export interface LearningPathResponse {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  domain_id?: string;
  path_type: "single_graph" | "cross_graph";
  total_estimated_time: number;
  ai_generated: boolean;
  status: LearningPathStatus;
  daily_minutes_target: number;
  /** 学习窗口（P5 排课回写）：首末排期日；未排课时为 null/缺省 */
  scheduled_start_date?: string | null;
  scheduled_end_date?: string | null;
  created_at: string;
  updated_at: string;
  nodes?: LearningPathNodeResponse[];
  progress?: LearningPathProgressSummary;
  /** list 接口平铺返回的计数（有 internal 项目使用） */
  nodes_count?: number;
  completed_nodes_count?: number;
}

/** 小路径日排课单节点结果（P5） */
export interface PathScheduledNode {
  nodeId: string;
  knowledgePointId: string;
  scheduledDate: string;
  estimatedTime: number;
  isMilestone: boolean;
  /** 是否复用/合并已有排期（同知识点已被任何路径排期） */
  merged: boolean;
}

/** 小路径日排课结果（P5，POST /:id/schedule 与 /:id/schedule/replan 响应） */
export interface PathScheduleResponse {
  pathId: string;
  scheduled: PathScheduledNode[];
  startDate?: string;
  endDate?: string;
  /** replan 响应额外携带：被清除归属的排期行数 */
  clearedRows?: number;
}

/** 跨图学习路径周窗口（P2 两级排课） */
export interface StageWindow {
  id?: string;
  stageIndex: number;
  graphId: string | null;
  graphNodeId: string;
  title?: string;
  weekStartDate: string;
  weekEndDate: string;
  plannedMinutes: number;
  status: "planned" | "in_progress" | "completed" | "skipped";
  /** 派生：窗口已结束但仍为 planned → 进度滞后 */
  isLagging?: boolean;
}

/**
 * 学习路径日计划（后端 LearningPlan 结构）
 */
export interface LearningPlanResponse {
  id: string;
  user_id: string;
  path_id: string;
  node_id: string;
  status: string;
  progress_percentage: number;
  time_spent: number;
  notes?: string;
  planned_duration?: number;
  planned_nodes: string[];
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

/**
 * 学习路径推荐
 */
export interface LearningPathRecommendation {
  node_id?: string;
  title: string;
  description?: string;
  priority: "high" | "medium" | "low";
  type?: string;
}

/**
 * 学习路径生成预览结果
 */
export interface LearningPathPreview {
  path?: LearningPathResponse;
  nodes?: LearningPathNodeResponse[];
  estimated_days?: number;
  estimated_total_time?: number;
  [key: string]: unknown;
}

/**
 * 学习路径题目
 */
export interface LearningPathQuestions {
  questions?: Array<{
    id?: string;
    node_id?: string;
    type?: string;
    question?: string;
    answer?: string;
    options?: string[];
    difficulty?: number;
  }>;
  [key: string]: unknown;
}

/**
 * 学习路径生成结果
 */
export interface LearningPathResult {
  path?: LearningPathResponse;
  nodes?: LearningPathNodeResponse[];
  [key: string]: unknown;
}

export interface CreateLearningPathInput {
  title: string;
  description?: string;
  goal?: string;
  target_date?: string;
  source_graph_id?: string;
  total_estimated_time?: number;
  ai_generated?: boolean;
  daily_minutes_target?: number;
  nodes?: Array<{
    knowledge_point_id?: string;
    order_index: number;
    title: string;
    description?: string;
    estimated_time?: number;
    is_milestone?: boolean;
    prerequisites?: string[];
  }>;
}

/** 跨图谱学习路径（大调度）图谱级阶段 */
export interface CrossGraphStage {
  graphId: string;
  graphTitle: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  isCompleted: boolean;
  completion: number;
  prerequisites: string[];
}

/** 跨图谱学习路径生成结果 */
export interface CrossGraphPathResult {
  pathId: string;
  pathTitle?: string;
  totalGraphs: number;
  pendingGraphs: number;
  completedGraphs: number;
  stages: CrossGraphStage[];
  suggestions: string[];
  pathReused: boolean;
}

/** 跨图路径中「下一个该学的图谱」 */
export interface NextCrossGraph {
  graphId: string;
  graphTitle: string;
  order: number;
  completion: number;
  nodeCount: number;
}

/** 跨图路径概览（首页「下一步」/学习路径面板） */
export interface CrossGraphSummary {
  pathId: string;
  pathTitle?: string;
  totalGraphs: number;
  completedGraphs: number;
  pendingGraphs: number;
  nextGraph: NextCrossGraph | null;
  /** 按顺序排列的图谱级阶段（含完成态），供图谱地图叠加学习顺序 */
  stages: Array<{
    graphId: string;
    graphTitle: string;
    order: number;
    completion: number;
    isCompleted: boolean;
  }>;
}

/** 目标驱动候选路径的侧重类型 */
export type VariantEmphasis = "goal_oriented" | "systematic" | "quick_overview";

/** 候选路径内的图谱级阶段 */
export interface VariantStage {
  graphId: string;
  graphTitle: string;
  order: number;
  priority: "high" | "medium" | "low";
  reason: string;
  estimatedTime: number;
}

/** 目标驱动的候选跨图谱学习路径 */
export interface CrossGraphPathVariant {
  id: string;
  name: string;
  description: string;
  emphasis: VariantEmphasis;
  estimatedWeeks?: number;
  totalEstimatedMinutes?: number;
  stages: VariantStage[];
  suggestions: string[];
}

export interface UpdateLearningPathInput {
  title?: string;
  description?: string;
  status?: LearningPathStatus;
  daily_minutes_target?: number;
  target_completion_date?: string;
}

export interface AddNodeInput {
  node_id: string;
  estimated_minutes?: number;
  difficulty_level?: number;
}

export interface UpdateProgressInput {
  completed_nodes?: number;
  total_time_spent?: number;
  last_activity_at?: string;
}

export interface CreatePlanInput {
  date: string;
  planned_nodes: string[];
  estimated_minutes?: number;
  notes?: string;
}

export interface UpdatePlanInput {
  actual_nodes?: string[];
  actual_minutes?: number;
  completed?: boolean;
  notes?: string;
}

export interface GeneratePathInput {
  goal: string;
  context?: string;
  goal_type?: GoalType;
  target_knowledge_point_id?: string;
  template_id?: string;
  daily_minutes_target?: number;
  target_completion_date?: string;
  conversation_history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export const learningPathsApi = {
  list: (status?: LearningPathStatus) =>
    request<LearningPathResponse[]>(`/learning-paths${  status ? `?status=${status}` : ""}`),

  get: (id: string) => request<LearningPathResponse>(`/learning-paths/${id}`),

  create: (data: CreateLearningPathInput) =>
    request<LearningPathResponse>("/learning-paths", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: UpdateLearningPathInput) =>
    request<LearningPathResponse>(`/learning-paths/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string, hard = true) =>
    request<{ message: string }>(`/learning-paths/${id}${hard ? "?hard=true" : ""}`, {
      method: "DELETE",
    }),

  addNode: (pathId: string, data: AddNodeInput) =>
    request<LearningPathNodeResponse>(`/learning-paths/${pathId}/nodes`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateNodeStatus: (pathId: string, nodeId: string, status: NodeStatus) =>
    request<LearningPathNodeResponse>(`/learning-paths/${pathId}/nodes/${nodeId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    }),

  reorderNodes: (pathId: string, nodeIds: string[]) =>
    request<{ message: string }>(`/learning-paths/${pathId}/nodes/reorder`, {
      method: "PUT",
      body: JSON.stringify({ node_order: nodeIds }),
    }),

  removeNode: (pathId: string, nodeId: string) =>
    request<{ message: string }>(`/learning-paths/${pathId}/nodes/${nodeId}`, { method: "DELETE" }),

  getProgress: (pathId: string) =>
    request<LearningPathProgressSummary>(`/learning-paths/${pathId}/progress`),

  updateProgress: (pathId: string, data: UpdateProgressInput) =>
    request<LearningPathProgressSummary>(`/learning-paths/${pathId}/progress`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  createPlan: (pathId: string, data: CreatePlanInput) =>
    request<LearningPlanResponse>(`/learning-paths/${pathId}/plans`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getPlans: (pathId: string, startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    const queryString = params.toString();
    return request<LearningPlanResponse[]>(
      `/learning-paths/${pathId}/plans${queryString ? `?${queryString}` : ""}`,
    );
  },

  getPlan: (pathId: string, date: string) =>
    request<LearningPlanResponse>(`/learning-paths/${pathId}/plans/${date}`),

  updatePlan: (pathId: string, date: string, data: UpdatePlanInput) =>
    request<LearningPlanResponse>(`/learning-paths/${pathId}/plans/${date}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  generateFromGraph: (data: GeneratePathInput) =>
    request<LearningPathResult>("/learning-paths/generate", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  adjust: (
    id: string,
    data: {
      reason: string;
      node_ref_id?: string;
      adjustment_type: "insert" | "remove" | "reorder" | "difficulty";
    },
  ) =>
    request<LearningPathResponse>(`/learning-paths/${id}/adjust`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getRecommendations: (graphId: string) =>
    request<LearningPathRecommendation[]>(`/learning-paths/recommendations?graph_id=${graphId}`),

  schedulePath: (pathId: string, options?: { start_date?: string }) =>
    request<PathScheduleResponse>(`/learning-paths/${pathId}/schedule`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  replanSchedule: (pathId: string, options?: { start_date?: string }) =>
    request<PathScheduleResponse>(`/learning-paths/${pathId}/schedule/replan`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  getStageWindows: (pathId: string) =>
    request<{ windows: StageWindow[] }>(`/learning-paths/${pathId}/stage-windows`),

  replanStageWindows: (pathId: string, options?: { start_date?: string }) =>
    request<{
      pathId: string;
      windows: StageWindow[];
      startDate?: string;
      endDate?: string;
    }>(`/learning-paths/${pathId}/stage-windows/replan`, {
      method: "POST",
      body: JSON.stringify(options || {}),
    }),

  postponeStageWindows: (pathId: string) =>
    request<{ pathId: string; postponedFrom: string; windows: StageWindow[] }>(
      `/learning-paths/${pathId}/stage-windows/postpone`,
      { method: "POST" },
    ),

  generateCrossGraph: (data?: {
    daily_time_minutes?: number;
    title?: string;
    force?: boolean;
    target_goal?: string;
  }) =>
    request<{ success: boolean; data: CrossGraphPathResult }>(
      "/learning-paths/generate-cross-graph",
      {
        method: "POST",
        body: JSON.stringify(data || {}),
      },
    ),

  getNextCrossGraph: () =>
    request<{ success: boolean; data: NextCrossGraph | null }>(
      "/learning-paths/cross-graph/next",
    ),

  getCrossGraphSummary: () =>
    request<{ success: boolean; data: CrossGraphSummary | null }>(
      "/learning-paths/cross-graph/summary",
    ),

  // ── 目标驱动候选路径（AI 对话 + 候选生成 + 保存）────────────

  /**
   * 图谱地图选中上下文：把用户在图谱地图上选中的图谱（节点）与领域作为
   * 主要上下文传入学习路径创建，使建议/对话/候选路径更具针对性。
   */
  suggestGoals: (data?: {
    provider?: string;
    model?: string;
    selected_graph_ids?: string[];
    selected_domain_ids?: string[];
  }) =>
    request<{ success: boolean; data: { suggestedGoals: string[] } }>(
      "/learning-paths/cross-graph/goal/suggest",
      { method: "POST", body: JSON.stringify(data || {}) },
    ),

  dialogStream: async (
    data: {
      message: string;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
      provider?: string;
      model?: string;
      language?: string;
      session_id?: string;
      selected_graph_ids?: string[];
      selected_domain_ids?: string[];
    },
    onChunk: (content: string) => void,
    signal?: AbortSignal,
  ) => {
    const config = getAIConfig("text");
    const payload = { ...data, language: data.language || getAILanguage() };
    if (!payload.provider && config.provider) payload.provider = config.provider;
    if (!payload.model && config.model) payload.model = config.model;

    // 统一走 streamRequest（唯一 SSE 出口）：鉴权/CSRF/移动端头/401 清登录态
    // 由 streamHandler 内聚，错误事件（含 [DONE]）在此统一处理
    await createStreamHandler(
      "/learning-paths/cross-graph/goal/dialog",
      payload,
      onChunk,
      { signal },
    );
  },

  /**
   * 提交「生成候选跨图谱学习路径」后台任务。
   *
   * AI 生成较耗时，改为后台任务执行：返回 taskId，前端可关闭面板；
   * 任务完成后经 SSE 通知，再从任务 output_data 回填变体列表续接。
   */
  generateVariantsBackground: (data: {
    target_goal: string;
    conversation_transcript?: string;
    daily_time_minutes?: number;
    variant_count?: number;
    provider?: string;
    model?: string;
    selected_graph_ids?: string[];
    selected_domain_ids?: string[];
  }) =>
    request<{ success: boolean; data: { taskId: string; taskType: string } }>(
      "/learning-paths/cross-graph/goal/variants",
      { method: "POST", body: JSON.stringify(data) },
    ),

  saveVariant: (data: {
    variant: {
      id: string;
      name: string;
      description?: string;
      emphasis?: VariantEmphasis;
      stages: Array<{
        graph_id: string;
        graph_title: string;
        order: number;
        priority: "high" | "medium" | "low";
        reason?: string;
        estimated_time: number;
      }>;
    };
    target_goal?: string;
    daily_time_minutes?: number;
  }) =>
    request<{
      success: boolean;
      data: {
        pathId: string;
        pathTitle: string;
        stages: VariantStage[];
        archivedOld: boolean;
      };
    }>("/learning-paths/cross-graph/goal/save", {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

export const learningPathApi = {
  getQuestions: (data: { graph_id: string }) =>
    request<LearningPathQuestions>("/learning-paths/questions", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  generate: (data: {
    graph_id: string;
    target_goal?: string;
    target_knowledge_point_id?: string;
    learning_style?: "sequential" | "exploratory" | "focused" | "custom";
    daily_time_minutes?: number;
    current_knowledge?: string;
    provider?: string;
    model?: string;
  }) =>
    request<LearningPathPreview>("/learning-paths/generate-preview", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getProgress: (graphId: string) =>
    request<{
      totalNodes: number;
      masteredNodes: number;
      learningNodes: number;
      newNodes: number;
      progress: number;
    }>(`/learning-paths/progress/${graphId}`),
};
