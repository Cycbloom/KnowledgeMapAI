import type { StatisticsResponse } from "@shared/types/api";

export interface IStatisticsApi {
  getStats(): Promise<StatisticsResponse>;
}
