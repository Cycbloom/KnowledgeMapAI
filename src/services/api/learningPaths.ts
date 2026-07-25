import { request } from "./client";

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
  created_at: string;
  updated_at: string;
  nodes?: LearningPathNodeResponse[];
  progress?: LearningPathProgressSummary;
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

  delete: (id: string) =>
    request<{ message: string }>(`/learning-paths/${id}`, { method: "DELETE" }),

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

  autoSchedule: (
    pathId: string,
    options?: {
      start_date?: string;
      daily_minutes?: number;
    },
  ) =>
    request<{
      success: boolean;
      main_task_id: string;
      subtask_ids: string[];
      total_tasks: number;
      estimated_days: number;
    }>(`/learning-paths/${pathId}/auto-schedule`, {
      method: "POST",
      body: JSON.stringify(options || {}),
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
