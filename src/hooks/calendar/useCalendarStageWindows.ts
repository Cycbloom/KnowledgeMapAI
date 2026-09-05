import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import type { CalendarEvent, CalendarMode } from "../../types/calendar";

/**
 * 日历「周窗口」图层（跨图路径图谱级阶段，P2 两级排课）：
 * 返回连续周窗口（start/end 为起止日，非逐日展开），供月/周视图
 * 渲染为「阶段条」连续色块，直观呈现每个阶段覆盖的整周范围。
 */
export function useCalendarStageWindows(
  calendarMode: CalendarMode,
  startDate: string,
  endDate: string,
): { data: CalendarEvent[]; isLoading: boolean } {
  const enabled = calendarMode === "plan" && !!startDate && !!endDate;
  const { data, isLoading } = useQuery({
    queryKey: ["calendar", "stage-windows", startDate, endDate],
    queryFn: () => api.scheduler.getStageWindows(startDate, endDate),
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
    graphId: e.graphId,
    pathId: e.pathId,
    scheduledDate: e.scheduledDate,
    status: e.status,
    stageIndex: e.stageIndex,
    taskId: e.taskId,
    has_subtasks: false,
  }));

  return {
    data: events,
    isLoading: enabled ? isLoading : false,
  };
}
