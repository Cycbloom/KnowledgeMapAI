import { request } from './client';
import type { AIPerformanceLog, AIPerformanceStats, GetPerformanceLogsQuery } from '@shared/types';

export const performanceApi = {
  getLogs: async (query: GetPerformanceLogsQuery = {}): Promise<{ logs: AIPerformanceLog[] }> => {
    const params = new URLSearchParams();
    if (query.limit) params.set('limit', String(query.limit));
    if (query.offset) params.set('offset', String(query.offset));
    if (query.operation) params.set('operation', query.operation);
    if (query.provider) params.set('provider', query.provider);
    if (query.success !== undefined) params.set('success', String(query.success));
    if (query.startTime) params.set('startTime', String(query.startTime));
    if (query.endTime) params.set('endTime', String(query.endTime));
    
    return request<{ logs: AIPerformanceLog[] }>(`/ai/performance/logs?${params}`);
  },

  getStats: async (query: { startTime?: number; endTime?: number } = {}): Promise<AIPerformanceStats> => {
    const params = new URLSearchParams();
    if (query.startTime) params.set('startTime', String(query.startTime));
    if (query.endTime) params.set('endTime', String(query.endTime));

    return request<AIPerformanceStats>(`/ai/performance/stats?${params}`);
  },

  clearLogs: async (beforeTimestamp?: number): Promise<void> => {
    const params = beforeTimestamp ? `?beforeTimestamp=${beforeTimestamp}` : '';
    return request<void>(`/ai/performance/logs${params}`, { method: 'DELETE' });
  },
};
