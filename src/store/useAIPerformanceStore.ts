import { create } from 'zustand';
import type { AIPerformanceLog, AIPerformanceStats, GetPerformanceLogsQuery } from '@shared/types';
import { request } from '@/services/api/client';

interface AIPerformanceState {
  logs: AIPerformanceLog[];
  stats: AIPerformanceStats | null;
  isLoading: boolean;
  error: string | null;
  
  setLogs: (logs: AIPerformanceLog[]) => void;
  setStats: (stats: AIPerformanceStats) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  
  fetchLogs: (query?: GetPerformanceLogsQuery) => Promise<void>;
  fetchStats: (query?: GetPerformanceLogsQuery) => Promise<void>;
  clearLogs: (beforeTimestamp?: number) => Promise<void>;
}

export const useAIPerformanceStore = create<AIPerformanceState>((set) => ({
  logs: [],
  stats: null,
  isLoading: false,
  error: null,
  
  setLogs: (logs) => set({ logs }),
  setStats: (stats) => set({ stats }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
  
  fetchLogs: async (query = {}) => {
    set({ isLoading: true, error: null });
    try {
      const params = new URLSearchParams();
      if (query.limit) params.set('limit', String(query.limit));
      if (query.offset) params.set('offset', String(query.offset));
      if (query.operation) params.set('operation', query.operation);
      if (query.provider) params.set('provider', query.provider);
      if (query.success !== undefined) params.set('success', String(query.success));
      if (query.startTime) params.set('startTime', String(query.startTime));
      if (query.endTime) params.set('endTime', String(query.endTime));
      
      const queryString = params.toString();
      const url = queryString ? `/ai/performance/logs?${queryString}` : '/ai/performance/logs';
      const data = await request<{ logs: AIPerformanceLog[] }>(url);
      set({ logs: data.logs, isLoading: false });
    } catch (error) {
      set({ error: '获取性能日志失败', isLoading: false });
    }
  },
  
  fetchStats: async (query = {}) => {
    try {
      const params = new URLSearchParams();
      if (query.startTime) params.set('startTime', String(query.startTime));
      if (query.endTime) params.set('endTime', String(query.endTime));
      
      const queryString = params.toString();
      const url = queryString ? `/ai/performance/stats?${queryString}` : '/ai/performance/stats';
      const stats = await request<AIPerformanceStats>(url);
      set({ stats });
    } catch (error) {
      set({ error: '获取统计数据失败' });
    }
  },
  
  clearLogs: async (beforeTimestamp) => {
    try {
      const params = beforeTimestamp ? `?beforeTimestamp=${beforeTimestamp}` : '';
      await request(`/ai/performance/logs${params}`, { method: 'DELETE' });
      set({ logs: [], stats: null });
    } catch (error) {
      set({ error: '清除日志失败' });
    }
  },
}));
