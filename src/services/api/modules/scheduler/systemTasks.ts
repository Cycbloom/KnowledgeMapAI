import { request } from "../../client";
import type { SystemTask, CreateSystemTaskData } from "@shared/types";

export type { SystemTask, CreateSystemTaskData };

export interface GetSystemTasksOptions {
  status?: string;
  limit?: number;
}

export interface SystemTaskStats {
  total: number;
  pending: number;
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export const systemTasksApi = {
  getSystemTasks: (options?: GetSystemTasksOptions) => {
    const params = new URLSearchParams();
    if (options?.status) {
      params.append("status", options.status);
    }
    if (options?.limit) {
      params.append("limit", options.limit.toString());
    }
    const queryString = params.toString();
    return request<SystemTask[]>(`/scheduler/system-tasks${queryString ? `?${queryString}` : ""}`);
  },

  createSystemTask: (data: CreateSystemTaskData) =>
    request<SystemTask>("/scheduler/system-tasks", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  retrySystemTask: (id: string) =>
    request<SystemTask>(`/scheduler/system-tasks/${id}/retry`, {
      method: "POST",
    }),

  cancelSystemTask: (id: string) =>
    request<SystemTask>(`/scheduler/system-tasks/${id}/cancel`, {
      method: "POST",
    }),

  getSystemTaskStats: () =>
    request<SystemTaskStats>("/scheduler/system-tasks/stats"),
};
