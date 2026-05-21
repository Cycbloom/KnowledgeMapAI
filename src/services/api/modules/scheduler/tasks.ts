import { request } from "../../client";
import type {
  CreateUserTaskData,
  UpdateUserTaskData,
  UserTaskFilters,
} from "@shared/types";

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
    request("/scheduler/tasks", { method: "POST", body: JSON.stringify(data) }),

  list: (filters?: UserTaskFilters) => {
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

  get: (id: string) => request(`/scheduler/tasks/${id}`),

  getDetail: (id: string) => request(`/scheduler/tasks/${id}/detail`),

  update: (id: string, data: UpdateUserTaskData) =>
    request(`/scheduler/tasks/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/scheduler/tasks/${id}`, { method: "DELETE" }),

  start: (id: string) =>
    request(`/scheduler/tasks/${id}/start`, { method: "POST" }),

  pause: (id: string) =>
    request(`/scheduler/tasks/${id}/pause`, { method: "POST" }),

  complete: (id: string) =>
    request(`/scheduler/tasks/${id}/complete`, { method: "POST" }),

  demote: (id: string) =>
    request(`/scheduler/tasks/${id}/demote`, { method: "POST" }),

  move: (id: string, targetQueue: number | string) => {
    const body =
      typeof targetQueue === "number"
        ? { target_queue: targetQueue }
        : { target_queue_id: targetQueue };
    return request(`/scheduler/tasks/${id}/move`, {
      method: "PUT",
      body: JSON.stringify(body),
    });
  },

  reorder: (queueLevel: number, taskIds: string[]) =>
    request(`/scheduler/tasks/reorder`, {
      method: "PUT",
      body: JSON.stringify({ queue_level: queueLevel, task_ids: taskIds }),
    }),

  generateDetails: (title: string, context?: string) =>
    request("/scheduler/generate-details", {
      method: "POST",
      body: JSON.stringify({ title, context }),
    }),

  updateNotes: (id: string, notes: string) =>
    request(`/scheduler/tasks/${id}/notes`, {
      method: "PUT",
      body: JSON.stringify({ notes }),
    }),

  getSmartRecommendation: () => request("/scheduler/smart-recommendation"),

  getEfficiencyProfile: (days: number = 30) =>
    request(`/scheduler/efficiency-data?days=${days}`),

  getDynamicPriority: (id: string) =>
    request(`/scheduler/tasks/${id}/dynamic-priority`),

  checkDependencies: (id: string) =>
    request(`/scheduler/tasks/${id}/dependency-check`),
};
