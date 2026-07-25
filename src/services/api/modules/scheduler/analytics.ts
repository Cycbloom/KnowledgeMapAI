import { requestData } from "../../client";
import type {
  UserTaskStats,
  HeatmapData,
  TaskAnalytics,
  TaskInsightsResult,
} from "@shared/types";

// Re-export for backwards compatibility with existing imports.
export type { UserTaskStats, HeatmapData };

export const analyticsApi = {
  getStats: (
    period: "day" | "week" | "month" | "year" = "week",
  ): Promise<UserTaskStats> =>
    requestData<UserTaskStats>(`/scheduler/stats?period=${period}`),

  getHeatmap: (year?: number, month?: number): Promise<HeatmapData[]> => {
    const params = new URLSearchParams();
    if (year !== undefined) params.append("year", year.toString());
    if (month !== undefined) params.append("month", month.toString());
    const queryString = params.toString();
    return requestData<HeatmapData[]>(
      `/scheduler/heatmap${queryString ? `?${queryString}` : ""}`,
    );
  },

  getTaskAnalytics: (): Promise<TaskAnalytics> =>
    requestData<TaskAnalytics>("/scheduler/analytics"),

  generateInsights: (): Promise<TaskInsightsResult> =>
    requestData<TaskInsightsResult>("/scheduler/analytics/insights", {
      method: "POST",
    }),
};
