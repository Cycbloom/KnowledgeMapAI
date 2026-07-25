import { requestData } from "../../client";
import type { ProgressMode } from "./tasks";
import type { TaskSchedule, TaskProgressPlan } from "@shared/types";

export const schedulesApi = {
  createSchedule: (data: {
    task_template_id: string;
    schedule_type: "daily" | "weekly" | "custom" | "smart";
    schedule_config?: Record<string, unknown>;
    is_active?: boolean;
  }) =>
    requestData<TaskSchedule>("/scheduler/schedules", {
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
    requestData<TaskSchedule>(`/scheduler/schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  deleteSchedule: (id: string) =>
    requestData<void>(`/scheduler/schedules/${id}`, { method: "DELETE" }),

  getSchedules: () => requestData<TaskSchedule[]>("/scheduler/schedules"),

  createProgressPlan: (
    taskId: string,
    data: {
      start_date: string;
      end_date: string;
      progress_mode: ProgressMode;
      custom_allocations?: Array<{ date: string; percentage: number }>;
    },
  ) =>
    requestData<TaskProgressPlan>(`/scheduler/tasks/${taskId}/progress-plan`, {
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
    requestData<TaskProgressPlan>(`/scheduler/tasks/${taskId}/progress-plan`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  getProgressPlan: async (taskId: string): Promise<TaskProgressPlan[]> => {
    const result = await requestData<{ task: unknown; plans: TaskProgressPlan[] }>(
      `/scheduler/tasks/${taskId}/progress-plan`,
    );
    return result.plans;
  },

  updateProgressPlanEntry: (
    taskId: string,
    data: {
      date?: string;
      percentage: number;
      notes?: string;
    },
  ) =>
    requestData<TaskProgressPlan>(`/scheduler/tasks/${taskId}/progress`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};
