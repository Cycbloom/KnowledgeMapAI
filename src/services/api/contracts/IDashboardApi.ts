import type { DashboardStats } from "@shared/types/api";

export interface IDashboardApi {
  getStats(): Promise<DashboardStats>;
}
