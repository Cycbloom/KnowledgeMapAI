import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { userTaskToCalendarEvent } from "../../utils/calendarEventMapper";
import type { CalendarEvent, CalendarMode } from "../../types/calendar";
import type { UserTask, UserTaskFilters } from "@shared/types";

const GC_TIME = 1000 * 60 * 60;

const realtimeQueryConfig = {
  staleTime: 5 * 60 * 1000,
  gcTime: GC_TIME,
  retry: 1,
};

export const calendarKeys = {
  events: (calendarMode: CalendarMode, filters?: UserTaskFilters) =>
    ["calendar", "events", calendarMode, filters] as const,
  executions: (filters?: { task_id?: string; from_date?: string; to_date?: string; status?: string }) =>
    ["calendar", "executions", filters] as const,
  activityStats: (startDate: string, endDate: string) =>
    ["calendar", "activityStats", startDate, endDate] as const,
  dailyActivities: (date: string) =>
    ["calendar", "dailyActivities", date] as const,
};

export function useCalendarEvents(
  calendarMode: CalendarMode,
  filters?: UserTaskFilters,
) {
  return useQuery({
    queryKey: calendarKeys.events(calendarMode, filters),
    queryFn: async (): Promise<CalendarEvent[]> => {
      if (calendarMode === "history") {
        return [];
      }
      const res = await api.scheduler.list(filters);
      const tasks: UserTask[] = res ?? [];
      return tasks.map((task) => userTaskToCalendarEvent(task));
    },
    enabled: calendarMode === "plan",
    ...realtimeQueryConfig,
  });
}
