import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../hooks";
import { queryKeys } from "../hooks/queries/config";
import {
  useCalendarNavigation,
  useCalendarEvents,
  useCalendarScheduleEvents,
  useCalendarExecutions,
  useCalendarActivityStats,
  useCalendarDailyActivities,
  type ViewType,
} from "../hooks/calendar";
import { CalendarHeader } from "../components/Calendar/CalendarHeader";
import { CalendarContent } from "../components/Calendar/CalendarContent";
import { CalendarTaskModal } from "../components/Calendar/CalendarTaskModal";
import { CalendarExportModal } from "../components/Calendar/CalendarExportModal";
import { Skeleton } from "../components/common";
import { api } from "../services/api";
import { message } from "../utils/messageHelper";
import { formatDate } from "../utils/formatters";
import type { CalendarEvent, EventDropInfo, CalendarMode } from "../types/calendar";

/** 本地时区 YYYY-MM-DD，与后端排期 scheduledDate 语义一致（避免 toISOString 的 UTC 偏移） */
function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

interface QuickTaskFormData {
  title: string; description: string; deadline: Date;
  estimated_duration: number; priority: number; tags: string[];
}

export const CalendarPage: React.FC = () => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const routerNavigate = useNavigate();
  const queryClient = useQueryClient();
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("plan");
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskDefaultDate, setTaskDefaultDate] = useState(new Date());

  const {
    currentDate,
    setCurrentDate,
    viewType,
    setViewType,
    navigate,
    goToToday,
  } = useCalendarNavigation();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const startDate = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const endDate = new Date(year, month + 1, 0).toISOString().split("T")[0];

  const { data: events = [], isLoading: eventsLoading } =
    useCalendarEvents(calendarMode);
  const { data: scheduleEvents = [] } = useCalendarScheduleEvents(
    calendarMode,
    startDate,
    endDate,
  );
  const { data: executions = [] } = useCalendarExecutions();

  // 合并路径排课图层（path_schedule）
  const combinedEvents = calendarMode === "plan"
    ? [...events, ...scheduleEvents]
    : events;

  const { data: activityStats = [] } = useCalendarActivityStats(
    calendarMode === "history" ? startDate : "",
    calendarMode === "history" ? endDate : "",
  );
  const { data: dailyActivities = [] } = useCalendarDailyActivities(
    calendarMode === "history" ? currentDate.toISOString().split("T")[0] : "",
  );

  const loading =
    calendarMode === "plan" ? eventsLoading : activityStats === undefined;

  const getTitle = useCallback(() => {
    if (viewType === "month" || viewType === "week") {
      return formatDate(currentDate, "month-year");
    }
    return formatDate(currentDate, "full-date");
  }, [currentDate, viewType]);

  const handleDateSelect = useCallback(
    (date: Date) => {
      setCurrentDate(date);
      setViewType("day" as ViewType);
    },
    [setCurrentDate, setViewType],
  );

  const handleEventClick = useCallback((event: CalendarEvent) => {
    if (event.type === "path_schedule") {
      if (event.knowledgePointId) {
        routerNavigate(`/study?node_id=${encodeURIComponent(event.knowledgePointId)}`);
      }
      return;
    }
    if (event.id) routerNavigate(`/scheduler/task/${event.id}`);
  }, [routerNavigate]);

  const handleAddEvent = useCallback((date: Date, hour?: number) => {
    const deadline = new Date(date);
    if (hour !== undefined) deadline.setHours(hour, 0, 0, 0);
    setTaskDefaultDate(deadline);
    setShowTaskModal(true);
  }, []);

  const handleCreateTask = async (formData: QuickTaskFormData) => {
    if (!formData.title.trim()) {
      message.error(t("calendar.enterTaskTitle"));
      return;
    }
    await api.scheduler.create({
      title: formData.title,
      description: formData.description,
      deadline: formData.deadline.toISOString(),
      estimated_duration: formData.estimated_duration,
      priority: formData.priority,
      tags: formData.tags,
      queue_level: formData.priority >= 3 ? 0 : formData.priority >= 2 ? 1 : 2,
    });
    message.success(t("toast.calendar.taskCreated"));
  };

  const handleEventDrop = useCallback(
    async (dropInfo: EventDropInfo) => {
      // 路径排课事件：手动改期
      if (dropInfo.eventId.startsWith("schedule-")) {
        const scheduleId = dropInfo.eventId.slice("schedule-".length);
        try {
          const newDate = toDateKey(dropInfo.newStart);
          await api.scheduler.reschedule(scheduleId, newDate);
          // 刷新日历排期图层（含跨月缓存）与调度决策，让「下一步」感知新排期
          await queryClient.invalidateQueries({
            queryKey: ["calendar", "schedule"],
          });
          await queryClient.invalidateQueries({
            queryKey: queryKeys.schedulerNextStep(),
          });
          message.success(t("calendar.pathScheduleMoved"));
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : t("calendar.pathScheduleMoveFailed");
          message.error(errorMessage);
        }
        return;
      }
      try {
        const updateData: { scheduled_start: string; scheduled_end?: string } = {
          scheduled_start: dropInfo.newStart.toISOString(),
        };
        if (dropInfo.newEnd)
          {updateData.scheduled_end = dropInfo.newEnd.toISOString();}
        await api.scheduler.update(dropInfo.eventId, updateData);
        message.success(t("toast.calendar.taskTimeUpdated"));
      } catch (error: unknown) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : t("toast.calendar.taskTimeUpdateFailed");
        message.error(errorMessage);
      }
    },
    [t, queryClient],
  );

  return (
    <div
      className={`h-full flex flex-col ${isDark ? "bg-slate-900" : "bg-gray-50"}`}
    >
      <h1 className="sr-only">{t('calendar.title')}</h1>
      <CalendarHeader
        currentDate={currentDate} viewType={viewType} calendarMode={calendarMode} showSubtasks={showSubtasks}
        onNavigate={navigate} goToToday={goToToday} onViewTypeChange={setViewType}
        onCalendarModeChange={setCalendarMode} onToggleSubtasks={() => setShowSubtasks(!showSubtasks)}
        onExport={() => setShowExportModal(true)} onAddEvent={(date) => handleAddEvent(date)} getTitle={getTitle}
      />

      <div className="flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="h-full flex flex-col">
            <div className="grid grid-cols-7 mb-2 gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" className="h-8" />
              ))}
            </div>
            <div className="grid grid-cols-7 flex-1 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <Skeleton key={i} variant="rectangular" className="min-h-[80px]" />
              ))}
            </div>
          </div>
        ) : (
          <CalendarContent
            viewType={viewType}
            currentDate={currentDate}
            events={combinedEvents}
            executions={executions}
            calendarMode={calendarMode}
            showSubtasks={showSubtasks}
            activityStats={activityStats}
            dailyActivities={dailyActivities}
            onDateSelect={handleDateSelect}
            onEventClick={handleEventClick}
            onAddEvent={handleAddEvent}
            onDateChange={setCurrentDate}
            onEventDrop={handleEventDrop}
          />
        )}
      </div>

      <CalendarTaskModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
        onCreateTask={handleCreateTask}
        defaultDate={taskDefaultDate}
      />
      <CalendarExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
      />
    </div>
  );
};
