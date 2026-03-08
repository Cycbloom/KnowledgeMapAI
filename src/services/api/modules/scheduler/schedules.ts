import { request } from "../../client.js";
import type { ProgressMode } from "./tasks.js";

export interface TaskSchedule {
  id: string;
  user_id: string;
  task_template_id: string;
  schedule_type: "daily" | "weekly" | "custom" | "smart";
  schedule_config: Record<string, unknown>;
  next_run_at?: string;
  last_run_at?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  task_template?: {
    id: string;
    title: string;
    description?: string;
    queue_level: number;
    priority: number;
    tags: string[];
  };
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

export const schedulesApi = {
  createSchedule: (data: {
    task_template_id: string;
    schedule_type: "daily" | "weekly" | "custom" | "smart";
    schedule_config?: Record<string, unknown>;
    is_active?: boolean;
  }) =>
    request("/scheduler/schedules", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateSchedule: (
    id: string,
    data: {
      schedule_config?: Record<string, unknown>;
      is_active?: boolean;
    },
  ) =>
    request(`/scheduler/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSchedule: (id: string) =>
    request(`/scheduler/schedules/${id}`, { method: "DELETE" }),

  getSchedules: () => request("/scheduler/schedules"),

  createProgressPlan: (
    taskId: string,
    data: {
      start_date: string;
      end_date: string;
      progress_mode: ProgressMode;
      custom_allocations?: Array<{ date: string; percentage: number }>;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/progress-plan`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  updateProgressPlan: (
    taskId: string,
    data: {
      planId?: string;
      date?: string;
      planned_percentage?: number;
      actual_percentage?: number;
      status?: "pending" | "completed" | "skipped";
      notes?: string;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/progress-plan`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getProgressPlan: (taskId: string) =>
    request(`/scheduler/tasks/${taskId}/progress-plan`),

  updateProgress: (
    taskId: string,
    data: {
      date?: string;
      percentage: number;
      notes?: string;
    },
  ) =>
    request(`/scheduler/tasks/${taskId}/progress`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
