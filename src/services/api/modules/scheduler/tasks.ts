import { requestData } from "../../client";
import type {
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  UserTask,
  UserTaskDetail,
  TaskExecution,
  GenerateTaskDetailsResult,
} from "@shared/types";
import type {
  SmartRecommendationResult,
  EfficiencyDataResult,
  DynamicPriorityResult,
  DependencyCheckResult,
} from "../../contracts/ISchedulerApi";

export type {
  UserTask,
  TaskType,
  ProgressMode,
  UserTaskStatus,
  TaskDependency,
  TaskExecution,
  UserTaskDetail,
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
  ExecutionFilters,
  QueueData,
  GenerateTaskDetailsResult,
} from "@shared/types";

export const tasksApi = {
  create: (data: CreateUserTaskData) =>
    requestData<UserTask>("/scheduler/tasks", { method: "POST", body: JSON.stringify(data) }),

  list: (filters?: UserTaskFilters) => {
    const params = new URLSearchParams();
    if (filters?.status) params.append("status", filters.status);
    if (filters?.queue_level !== undefined)
      {params.append("queue_level", filters.queue_level.toString());}
    if (filters?.tags?.length) params.append("tags", filters.tags.join(","));
    if (filters?.from_date) params.append("from_date", filters.from_date);
    if (filters?.to_date) params.append("to_date", filters.to_date);
    const queryString = params.toString();
    return requestData<UserTask[]>(`/scheduler/tasks${queryString ? `?${queryString}` : ""}`);
  },

  get: (id: string) => requestData<UserTask>(`/scheduler/tasks/${id}`),

  getDetail: (id: string) => requestData<UserTaskDetail>(`/scheduler/tasks/${id}/detail`),

  update: (id: string, data: UpdateUserTaskData) =>
    requestData<UserTask>(`/scheduler/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    requestData<void>(`/scheduler/tasks/${id}`, { method: "DELETE" }),

  start: (id: string) =>
    requestData<{ task: UserTask; execution: TaskExecution }>(`/scheduler/tasks/${id}/start`, { method: "POST" }),

  pause: (id: string) =>
    requestData<{ task: UserTask; duration: number }>(`/scheduler/tasks/${id}/pause`, { method: "POST" }),

  complete: (id: string) =>
    requestData<UserTask>(`/scheduler/tasks/${id}/complete`, { method: "POST" }),

  demote: (id: string) =>
    requestData<UserTask>(`/scheduler/tasks/${id}/demote`, { method: "POST" }),

  move: (id: string, targetQueue: number | string) => {
    const body =
      typeof targetQueue === "number"
        ? { target_queue: targetQueue }
        : { target_queue_id: targetQueue };
    return requestData<UserTask>(`/scheduler/tasks/${id}/move`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  reorder: (queueLevel: number, taskIds: string[]) =>
    requestData<void>(`/scheduler/tasks/reorder`, {
      method: "PUT",
      body: JSON.stringify({ queue_level: queueLevel, task_ids: taskIds }),
    }),

  generateDetails: (title: string, context?: string) =>
    requestData<GenerateTaskDetailsResult>("/scheduler/generate-details", {
      method: "POST",
      body: JSON.stringify({ title, context }),
    }),

  updateNotes: (id: string, notes: string) =>
    requestData<UserTask>(`/scheduler/tasks/${id}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  getSmartRecommendation: () => requestData<SmartRecommendationResult>("/scheduler/smart-recommendation"),

  getEfficiencyProfile: (days: number = 30) =>
    requestData<EfficiencyDataResult>(`/scheduler/efficiency-data?days=${days}`),

  getDynamicPriority: (id: string) =>
    requestData<DynamicPriorityResult>(`/scheduler/tasks/${id}/dynamic-priority`),

  checkDependencies: (id: string) =>
    requestData<DependencyCheckResult>(`/scheduler/tasks/${id}/dependency-check`),

  updateProgress: (id: string, data: {
    progress_percentage?: number;
    actual_duration_add?: number;
  }) =>
    requestData<UserTask>(`/scheduler/tasks/${id}/progress`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  tickExecution: (taskId: string, durationSeconds: number) =>
    requestData<TaskExecution>(`/scheduler/tasks/${taskId}/execution/tick`, {
      method: "PATCH",
      body: JSON.stringify({ duration_seconds: durationSeconds }),
    }),
};
