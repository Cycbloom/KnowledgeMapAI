import { useMemo } from "react";
import { userTaskToCalendarEvent } from "../../utils/calendarEventMapper";
import { useSchedulerTasks } from "../scheduler/useScheduler";
import type { CalendarEvent, CalendarMode } from "../../types/calendar";
import type { UserTaskFilters } from "@shared/types";

/**
 * 日历"计划"视图的事件列表。
 *
 * 复用 useSchedulerTasks（相同 queryKeys.schedulerTasks 缓存键），
 * 避免与调度页各自拉取同一 GET /tasks 造成重复请求。
 */
export function useCalendarEvents(
  calendarMode: CalendarMode,
  filters?: UserTaskFilters,
): { data: CalendarEvent[]; isLoading: boolean } {
  const { data: tasks, isLoading } = useSchedulerTasks(
    filters,
    calendarMode === "plan",
  );
  const events = useMemo(
    () => (tasks ?? []).map((task) => userTaskToCalendarEvent(task)),
    [tasks],
  );
  return { data: calendarMode === "history" ? [] : events, isLoading };
}
