import { request } from "../../client";

export interface UserTaskStats {
  total_tasks: number;
  completed_tasks: number;
  total_duration: number;
  avg_duration: number;
  completion_rate: number;
  tasks_by_queue: { q0: number; q1: number; q2: number };
  tasks_by_status: Record<string, number>;
  daily?: Array<{
    date: string;
    completed: number;
    duration: number;
  }>;
}

export interface HeatmapData {
  date: string;
  count: number;
  duration: number;
}

export const analyticsApi = {
  getStats: (period: "day" | "week" | "month" | "year" = "week") =>
    request(`/scheduler/stats?period=${period}`),

  getHeatmap: (year?: number, month?: number) => {
    const params = new URLSearchParams();
    if (year !== undefined) params.append("year", year.toString());
    if (month !== undefined) params.append("month", month.toString());
    const queryString = params.toString();
    return request(`/scheduler/heatmap${queryString ? `?${queryString}` : ""}`);
  },

  getTaskAnalytics: () => request("/scheduler/analytics"),

  generateInsights: () =>
    request("/scheduler/analytics/insights", { method: "POST" }),
};
