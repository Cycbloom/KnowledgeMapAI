import type { AIPerformanceLog, AIPerformanceStats, GetPerformanceLogsQuery } from '@shared/types';

export interface IPerformanceApi {
  getLogs(query?: GetPerformanceLogsQuery): Promise<{ logs: AIPerformanceLog[] }>;

  getStats(query?: { startTime?: number; endTime?: number }): Promise<AIPerformanceStats>;

  clearLogs(beforeTimestamp?: number): Promise<void>;
}
