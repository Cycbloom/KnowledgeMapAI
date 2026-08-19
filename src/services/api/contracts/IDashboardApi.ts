import type { DashboardStats, TodaySummary } from "@shared/types/api";

export interface IDashboardApi {
  getStats(): Promise<DashboardStats>;
  getTodaySummary(): Promise<TodaySummary>;
}
