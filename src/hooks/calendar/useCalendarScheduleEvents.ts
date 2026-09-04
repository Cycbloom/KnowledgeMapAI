import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { CalendarEvent, CalendarMode } from "../../types/calendar";

/**
 * 日历「路径排课」图层：拉取学习路径知识点排期并映射为 CalendarEvent。
 * 供 plan 视图展示当天该学哪些知识点（path_schedule 类型，可点击跳转学习）。
 */
export function useCalendarScheduleEvents(
  calendarMode: CalendarMode,
  startDate: string,
  endDate: string,
): { data: CalendarEvent[]; isLoading: boolean } {
  const enabled = calendarMode === "plan" && !!startDate && !!endDate;
  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "schedule", startDate, endDate],
    queryFn: () => api.scheduler.getScheduleEvents(startDate, endDate),
    enabled,
    staleTime: 30_000,
  });

  const events: CalendarEvent[] = (data ?? []).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    start: e.start,
    end: e.end,
    allDay: e.allDay,
    type: e.type,
    color: e.color,
    estimated_duration: undefined,
    knowledgePointId: e.knowledgePointId,
    scheduledDate: e.scheduledDate,
    has_subtasks: false,
  }));

  return {
    data: events,
    isLoading: enabled ? isLoading : false,
  };
}