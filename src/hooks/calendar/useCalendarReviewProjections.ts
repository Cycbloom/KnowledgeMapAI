import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { CalendarEvent, CalendarMode } from "../../types/calendar";

/**
 * 日历「复习到期预测」图层（P3 复习入历）：
 * FSRS next_review 按知识点 × 到期日聚合成只读事件（review_projection 类型）。
 * 投影随复习评分自愈，不落库、不可拖动。
 */
export function useCalendarReviewProjections(
  calendarMode: CalendarMode,
  startDate: string,
  endDate: string,
): { data: CalendarEvent[]; isLoading: boolean } {
  const enabled = calendarMode === "plan" && !!startDate && !!endDate;
  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "review-projections", startDate, endDate],
    queryFn: () => api.scheduler.getReviewProjections(startDate, endDate),
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
    estimated_duration: e.estimated_duration,
    knowledgePointId: e.knowledgePointId,
    scheduledDate: e.scheduledDate,
    has_subtasks: false,
  }));

  return {
    data: events,
    isLoading: enabled ? isLoading : false,
  };
}
