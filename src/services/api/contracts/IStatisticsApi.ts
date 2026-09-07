import type {
  DailyReport,
  MasteryHealthResponse,
  StatisticsResponse,
  WeeklyReport,
} from "@shared/types/api";

export interface IStatisticsApi {
  getStats(): Promise<StatisticsResponse>;
  getDailyReport(date?: string): Promise<DailyReport>;
  getWeeklyReport(weekStart?: string): Promise<WeeklyReport>;
  getMasteryHealth(): Promise<MasteryHealthResponse>;
}
