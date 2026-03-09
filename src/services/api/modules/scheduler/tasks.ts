import { request } from "../../client.js";
import type {
  ScheduledTask,
  TaskType,
  ProgressMode,
  TaskStatus,
  TaskDependency,
  TaskExecution,
  TaskDetail,
  CreateScheduledTaskData,
  UpdateScheduledTaskData,
  TaskFilters,
  ExecutionFilters,
  QueueData,
  GenerateTaskDetailsResult,
} from "@shared/types";

export type {
  ScheduledTask,
  TaskType,
  ProgressMode,
  TaskStatus,
  TaskDependency,
  TaskExecution,
  TaskDetail,
  CreateScheduledTaskData,
  UpdateScheduledTaskData,
  TaskFilters,
  ExecutionFilters,
  QueueData,
  GenerateTaskDetailsResult,
};

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
