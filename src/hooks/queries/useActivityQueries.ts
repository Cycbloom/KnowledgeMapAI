import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { GetActivitiesOptions } from "../../services/api/modules/scheduler/activities";

export function useActivities(options?: GetActivitiesOptions) {
  return useQuery({
    queryKey: ["activities", options],
    queryFn: async () => {
      const result = await api.scheduler.getActivities(options);
      return result;
    },
    staleTime: 30000,
  });
}

export function useDailyActivities(date: string) {
  return useQuery({
    queryKey: ["activities", "daily", date],
    queryFn: async () => {
      const result = await api.scheduler.getDailyActivities(date);
      return result;
    },
    enabled: !!date,
    staleTime: 30000,
  });
}

export function useActivityStats(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["activities", "stats", startDate, endDate],
    queryFn: async () => {
      const result = await api.scheduler.getActivityStats(startDate, endDate);
      return result;
    },
    enabled: !!startDate && !!endDate,
    staleTime: 60000,
  });
}
