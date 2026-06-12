import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { calendarKeys } from "./useCalendarEvents";
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
    queryKey: calendarKeys.activityStats(startDate, endDate),
    queryFn: async (): Promise<DailyActivityStats[]> => {
      const res = await api.scheduler.getActivityStats(startDate, endDate);
      return (res.data ?? []) as DailyActivityStats[];
    },
    enabled: !!startDate && !!endDate,
    ...defaultQueryConfig,
  });
}

export function useCalendarDailyActivities(date: string) {
  return useQuery({
    queryKey: calendarKeys.dailyActivities(date),
    queryFn: async (): Promise<ActivityEvent[]> => {
      const res = await api.scheduler.getDailyActivities(date);
      return (res.data ?? []) as ActivityEvent[];
    },
    enabled: !!date,
    ...defaultQueryConfig,
  });
}
