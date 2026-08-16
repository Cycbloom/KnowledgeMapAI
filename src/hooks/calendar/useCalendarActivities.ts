import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { DailyActivityStats, ActivityEvent } from "../../types/calendar";

const DEFAULT_STALE_TIME = 1000 * 60 * 5;
const GC_TIME = 1000 * 60 * 60;

const defaultQueryConfig = {
  staleTime: DEFAULT_STALE_TIME,
  gcTime: GC_TIME,
  retry: 2,
  retryDelay: (attemptIndex: number) =>
    Math.min(1000 * 2 ** attemptIndex, 30000),
};

export function useCalendarActivityStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["calendar", "activityStats", startDate, endDate],
    queryFn: async (): Promise<DailyActivityStats[]> => {
      return api.scheduler.getActivityStats(startDate, endDate);
    },
    enabled: !!startDate && !!endDate,
    ...defaultQueryConfig,
  });
}

export function useCalendarDailyActivities(date: string) {
  return useQuery({
    queryKey: ["calendar", "dailyActivities", date],
    queryFn: async (): Promise<ActivityEvent[]> => {
      return api.scheduler.getDailyActivities(date);
    },
    enabled: !!date,
    ...defaultQueryConfig,
  });
}
