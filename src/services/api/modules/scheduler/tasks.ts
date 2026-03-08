import { request } from "../../client.js";

export type TaskType = "one_time" | "long_term" | "periodic" | "learning";
export type ProgressMode = "average" | "decreasing" | "increasing" | "custom";
export type TaskStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "completed"
  | "cancelled";

export interface ScheduledTask {
  id: string;
  user_id: string;
  title: string;
  description?: string;
  queue_level: number;
  position: number;
  estimated_duration?: number;
  actual_duration?: number;
  deadline?: string;
  status: TaskStatus;
  tags: string[];
  knowledge_point_id?: string;
  priority: number;
  queue_id?: string;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
  completed_at?: string;
  task_type?: TaskType;
  total_duration?: number;
  progress_mode?: ProgressMode;
  progress_percentage?: number;
  parent_task_id?: string;
  context?: string;
  dependencies?: TaskDependency[];
}

export interface TaskDependency {
  id: string;
  task_id: string;
  depends_on_task_id: string;
  dependency_type: "strict" | "soft";
  created_at: string;
  depends_on_task?: {
    id: string;
    title: string;
    description?: string;
    status: string;
    queue_level: number;
    priority: number;
  };
}

export interface TaskExecution {
  id: string;
  task_id: string;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration?: number;
  queue_level: number;
  status: "completed" | "interrupted" | "time_slice_ended";
}

export interface TaskProgressPlan {
  id: string;
  task_id: string;
  plan_date: string;
  planned_percentage: number;
  actual_percentage: number;
  status: "pending" | "completed" | "skipped";
  notes?: string;
  created_at: string;
}

export interface TaskDetail extends ScheduledTask {
  dependencies: TaskDependency[];
  dependents: TaskDependency[];
  progress_plans: TaskProgressPlan[];
  executions: TaskExecution[];
  required_time_slots?: number;
}

export interface CreateScheduledTaskData {
  title: string;
  description?: string;
  queue_level?: number;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  knowledge_point_id?: string;
  priority?: number;
  task_type?: TaskType;
  total_duration?: number;
  progress_mode?: ProgressMode;
  context?: string;
  parent_task_id?: string;
}

export interface UpdateScheduledTaskData {
  title?: string;
  description?: string;
  estimated_duration?: number;
  deadline?: string;
  tags?: string[];
  priority?: number;
  task_type?: TaskType;
  total_duration?: number;
  progress_mode?: ProgressMode;
  progress_percentage?: number;
  context?: string;
  parent_task_id?: string;
  scheduled_start?: string;
  scheduled_end?: string;
}

export interface TaskFilters {
  status?: string;
  queue_level?: number;
  tags?: string[];
  from_date?: string;
  to_date?: string;
}

export interface ExecutionFilters {
  task_id?: string;
  from_date?: string;
  to_date?: string;
  status?: string;
}

export interface QueueData {
  q0: ScheduledTask[];
  q1: ScheduledTask[];
  q2: ScheduledTask[];
}

export interface GenerateTaskDetailsResult {
  description: string;
  tags: string[];
  estimated_duration: number;
  priority: number;
  suggested_queue: number;
}

export const tasksApi = {
  createTask: (data: CreateScheduledTaskData) =>
    request("/scheduler/tasks", { method: "POST", body: JSON.stringify(data) }),

  getTasks: (filters?: TaskFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.queue_level !== undefined)
      params.append("queue_level", filters.queue_level.toString());
    if (filters?.tags?.length) params.append("tags", filters.tags.join(","));
    if (filters?.from_date) params.append("from_date", filters.from_date);
    if (filters?.to_date) params.append("to_date", filters.to_date);
    const queryString = params.toString();
    return request(`/scheduler/tasks${queryString ? `?${queryString}` : ""}`);
  },

  getTask: (id: string) => request(`/scheduler/tasks/${id}`),

  getTaskDetail: (id: string) => request(`/scheduler/tasks/${id}/detail`),

  updateTask: (id: string, data: UpdateScheduledTaskData) =>
    request(`/scheduler/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteTask: (id: string) =>
    request(`/scheduler/tasks/${id}`, { method: "DELETE" }),

  startTask: (id: string) =>
    request(`/scheduler/tasks/${id}/start`, { method: "POST" }),

  pauseTask: (id: string) =>
    request(`/scheduler/tasks/${id}/pause`, { method: "POST" }),

  completeTask: (id: string) =>
    request(`/scheduler/tasks/${id}/complete`, { method: "POST" }),

  demoteTask: (id: string) =>
    request(`/scheduler/tasks/${id}/demote`, { method: "POST" }),

  moveTask: (id: string, targetQueue: number | string) => {
    const body =
      typeof targetQueue === "number"
        ? { target_queue: targetQueue }
        : { target_queue_id: targetQueue };
    return request(`/scheduler/tasks/${id}/move`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  reorderTasks: (queueLevel: number, taskIds: string[]) =>
    request(`/scheduler/tasks/reorder`, {
      method: "PUT",
      body: JSON.stringify({ queue_level: queueLevel, task_ids: taskIds }),
    }),

  generateTaskDetails: (title: string, context?: string) =>
    request("/scheduler/generate-details", {
      method: "POST",
      body: JSON.stringify({ title, context }),
    }),

  updateNotes: (taskId: string, notes: string) =>
    request(`/scheduler/tasks/${taskId}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  getSmartRecommendation: () => request("/scheduler/smart-recommendation"),

  getDynamicPriority: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dynamic-priority`),

  checkTaskDependencies: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/dependency-check`),
};
