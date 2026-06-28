import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { request } from "@/services/api/client";
import { queryKeys, defaultQueryConfig } from "./config";
import type {
  AIPerformanceLog,
  AIPerformanceStats,
  GetPerformanceLogsQuery,
} from "@shared/types";

interface LogsResponse {
  logs: AIPerformanceLog[];
}

const buildLogsUrl = (query?: GetPerformanceLogsQuery): string => {
  if (!query) return "/ai/performance/logs";
  const params = new URLSearchParams();
  if (query.limit) params.set("limit", String(query.limit));
  if (query.offset) params.set("offset", String(query.offset));
  if (query.operation) params.set("operation", query.operation);
  if (query.provider) params.set("provider", query.provider);
  if (query.success !== undefined) params.set("success", String(query.success));
  if (query.startTime) params.set("startTime", String(query.startTime));
  if (query.endTime) params.set("endTime", String(query.endTime));
  const queryString = params.toString();
  return queryString ? `/ai/performance/logs?${queryString}` : "/ai/performance/logs";
};

const buildStatsUrl = (query?: { startTime?: number; endTime?: number }): string => {
  if (!query) return "/ai/performance/stats";
  const params = new URLSearchParams();
  if (query.startTime) params.set("startTime", String(query.startTime));
  if (query.endTime) params.set("endTime", String(query.endTime));
  const queryString = params.toString();
  return queryString ? `/ai/performance/stats?${queryString}` : "/ai/performance/stats";
};

export const useAiPerformanceLogs = (query?: GetPerformanceLogsQuery) => {
  return useQuery<LogsResponse>({
    queryKey: queryKeys.aiPerformanceLogs(query),
    queryFn: () => request<LogsResponse>(buildLogsUrl(query)),
    ...defaultQueryConfig,
  });
};

export const useAiPerformanceStats = (query?: { startTime?: number; endTime?: number }) => {
  return useQuery<AIPerformanceStats>({
    queryKey: queryKeys.aiPerformanceStats(query),
    queryFn: () => request<AIPerformanceStats>(buildStatsUrl(query)),
    ...defaultQueryConfig,
  });
};

export const useClearAiPerformanceLogs = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (beforeTimestamp?: number) => {
      const params = beforeTimestamp ? `?beforeTimestamp=${beforeTimestamp}` : "";
      return request(`/ai/performance/logs${params}`, { method: "DELETE" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["aiPerformanceLogs"] });
      queryClient.invalidateQueries({ queryKey: ["aiPerformanceStats"] });
    },
  });
};
