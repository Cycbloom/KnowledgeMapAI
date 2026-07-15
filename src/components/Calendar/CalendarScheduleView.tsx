import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Move,
} from "lucide-react";
import { useTheme } from "../../hooks";
import { formatDurationMinutes, formatDate } from "../../utils/formatters";
import {
  CalendarEvent,
  ExecutionEvent,
  EventDropInfo,
  CalendarMode,
  ActivityEvent,
} from "../../types/calendar";
import { ActivityTimeline } from "./ActivityTimeline";
import { CalendarSubtaskStack } from "./CalendarSubtaskStack";
import type { TaskSubtask } from "@shared/types";

interface CalendarScheduleViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date, hour?: number) => void;
  onDateChange: (date: Date) => void;
  onEventDrop?: (dropInfo: EventDropInfo) => void;
  calendarMode?: CalendarMode;
  dailyActivities?: ActivityEvent[];
  showSubtasks?: boolean;
  onSubtaskClick?: (subtask: TaskSubtask, parentEvent: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarScheduleView: React.FC<CalendarScheduleViewProps> = ({
  currentDate,
  events,
  executions,
  onEventClick,
  onAddEvent,
  onDateChange,
  onEventDrop,
  calendarMode = "plan",
  dailyActivities = [],
  showSubtasks = false,
  onSubtaskClick,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [hoveredSlot, setHoveredSlot] = useState<{
    hour: number;
    y: number;
  } | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  const scheduleData = useMemo(() => {
    const dateStr = currentDate.toDateString();

    const dayEvents = events.filter((e) => {
      const eventDate = new Date(e.start).toDateString();
      return eventDate === dateStr;
    });

    const dayExecutions = executions.filter((e) => {
      const execDate = new Date(e.started_at).toDateString();
      return execDate === dateStr;
    });

    const slots: {
      hour: number;
      planned: CalendarEvent[];
      executed: ExecutionEvent[];
    }[] = HOURS.map((hour) => {
      const planned = dayEvents.filter((e) => {
        const eventHour = new Date(e.start).getHours();
        return eventHour === hour;
      });

      const executed = dayExecutions.filter((e) => {
        const execHour = new Date(e.started_at).getHours();
        return execHour === hour;
      });

      return { hour, planned, executed };
    });

    const totalPlannedMinutes = dayEvents.reduce((acc, e) => {
      const start = new Date(e.start);
      const end = e.end
        ? new Date(e.end)
        : new Date(start.getTime() + 60 * 60 * 1000);
      return acc + (end.getTime() - start.getTime()) / 60000;
    }, 0);

    const totalExecutedMinutes = dayExecutions.reduce((acc, e) => {
      return acc + (e.duration || 0);
    }, 0);

    const matchedExecutions = dayExecutions.filter((exec) => {
      return dayEvents.some((event) => {
        const eventStart = new Date(event.start);
        const execStart = new Date(exec.started_at);
        const timeDiff = Math.abs(eventStart.getTime() - execStart.getTime());
        return (
          timeDiff < 30 * 60 * 1000 &&
          event.title.toLowerCase().includes(exec.task_title.toLowerCase())
        );
      });
    });

    return {
      slots,
      events: dayEvents,
      executions: dayExecutions,
      stats: {
        plannedMinutes: Math.round(totalPlannedMinutes),
        executedMinutes: Math.round(totalExecutedMinutes),
        plannedCount: dayEvents.length,
        executedCount: dayExecutions.length,
        matchRate:
          dayEvents.length > 0
            ? Math.round((matchedExecutions.length / dayEvents.length) * 100)
            : 0,
      },
    };
  }, [currentDate, events, executions]);

  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case "task":
        return {
          bg: "bg-primary-500",
          border: "border-primary-600",
          light: "bg-primary-100 dark:bg-primary-500/20",
        };
      case "study":
        return {
          bg: "bg-primary-500",
          border: "border-primary-600",
          light: "bg-primary-100 dark:bg-primary-500/20",
        };
      case "review":
        return {
          bg: "bg-green-500",
          border: "border-green-600",
          light: "bg-green-100 dark:bg-green-500/20",
        };
      default:
        return {
          bg: "bg-gray-500",
          border: "border-gray-600",
          light: "bg-gray-100 dark:bg-gray-500/20",
        };
    }
  };

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const cellHeight = 80;
    const offsetHours = clickY / cellHeight;
    setDragOffset(offsetHours);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", event.id);
  };

  const handleDragOver = (e: React.DragEvent, hour: number) => {
    e.preventDefault();
    if (draggedEvent) {
      setDragOverHour(hour);
    }
  };

  const handleDragLeave = () => {
    setDragOverHour(null);
  };

  const handleDrop = (e: React.DragEvent, hour: number) => {
    e.preventDefault();

    if (draggedEvent && onEventDrop) {
      const newStart = new Date(currentDate);
      const adjustedHour = hour - Math.floor(dragOffset);
      newStart.setHours(adjustedHour, 0, 0, 0);

      const originalStart = new Date(draggedEvent.start);
      const originalEnd = draggedEvent.end ? new Date(draggedEvent.end) : null;
      let newEnd: Date | undefined;

      if (originalEnd) {
        const duration = originalEnd.getTime() - originalStart.getTime();
        newEnd = new Date(newStart.getTime() + duration);
      }

      onEventDrop({
        eventId: draggedEvent.id,
        newStart,
        newEnd,
      });
    }

    setDraggedEvent(null);
    setDragOverHour(null);
    setDragOffset(0);
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDragOverHour(null);
    setDragOffset(0);
  };

  const currentHour = new Date().getHours();
  const isToday = currentDate.toDateString() === new Date().toDateString();

  const goToPrevDay = () => {
    const prev = new Date(currentDate);
    prev.setDate(prev.getDate() - 1);
    onDateChange(prev);
  };

  const goToNextDay = () => {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + 1);
    onDateChange(next);
  };

  const goToToday = () => {
    onDateChange(new Date());
  };

  return (
    <div className="h-full flex flex-col">
      <div
        className={`px-4 py-3 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={goToPrevDay}
                aria-label={t("common.aria.prevDay")}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <ChevronLeft size={20} />
              </button>
              <h3
                className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {formatDate(currentDate, "month-day-weekday")}
              </h3>
              <button
                onClick={goToNextDay}
                aria-label={t("common.aria.nextDay")}
                className={`p-1.5 rounded-lg transition-colors ${
                  isDark
                    ? "hover:bg-slate-700 text-slate-400"
                    : "hover:bg-gray-100 text-gray-500"
                }`}
              >
                <ChevronRight size={20} />
              </button>
            </div>
            {!isToday && (
              <button
                onClick={goToToday}
                className={`px-3 py-1 text-sm rounded-lg ${
                  isDark
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                今天
              </button>
            )}
          </div>

          {calendarMode === "plan" && (
            <button
              onClick={() => onAddEvent(currentDate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              添加任务
            </button>
          )}
        </div>

        {calendarMode === "plan" && (
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                计划: {formatDurationMinutes(scheduleData.stats.plannedMinutes, { emptyText: "0分钟" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                实际: {formatDurationMinutes(scheduleData.stats.executedMinutes, { emptyText: "0分钟" })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                匹配率: {scheduleData.stats.matchRate}%
              </span>
            </div>
          </div>
        )}

        {calendarMode === "history" && (
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-primary-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                活动记录: {dailyActivities.length} 项
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                总时长:{" "}
                {formatDurationMinutes(
                  Math.round(
                    dailyActivities.reduce(
                      (acc, a) => acc + (a.duration || 0),
                      0,
                    ) / 60,
                  ),
                  { emptyText: "0分钟" },
                )}
              </span>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {calendarMode === "plan" && (
          <div className="relative min-h-[1920px]">
            {isToday && (
              <div
                className="absolute left-16 right-0 z-20 pointer-events-none"
                style={{
                  top: `${currentHour * 80 + (new Date().getMinutes() / 60) * 80}px`,
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse shadow-lg shadow-red-500/50" />
                  <div className="flex-1 h-0.5 bg-red-500" />
                  <span className="text-xs text-red-500 font-medium bg-white dark:bg-slate-900 px-1">
                    {formatDate(new Date(), "time")}
                  </span>
                </div>
              </div>
            )}

            {scheduleData.slots.map((slot) => (
              <div
                key={slot.hour}
                className={`flex h-[80px] border-b ${
                  isDark ? "border-slate-700/50" : "border-gray-100"
                } ${hoveredSlot?.hour === slot.hour ? "bg-primary-50/50 dark:bg-primary-500/5" : ""} ${
                  dragOverHour === slot.hour
                    ? "bg-primary-100/50 dark:bg-primary-500/20"
                    : ""
                }`}
                onMouseEnter={(e) => {
                  const rect = e.currentTarget.getBoundingClientRect();
                  setHoveredSlot({ hour: slot.hour, y: e.clientY - rect.top });
                }}
                onMouseLeave={() => setHoveredSlot(null)}
                onDragOver={(e) => handleDragOver(e, slot.hour)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, slot.hour)}
                onClick={() =>
                  !draggedEvent && onAddEvent(currentDate, slot.hour)
                }
              >
                <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1">
                  <span
                    className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {slot.hour.toString().padStart(2, "0")}:00
                  </span>
                </div>

                <div className="flex-1 relative p-1 flex gap-1">
                  <div className="flex-1 space-y-1">
                    {slot.planned.map((event, i) => {
                      const colors = getEventColor(event);
                      const isDragging = draggedEvent?.id === event.id;
                      return (
                        <div
                          key={`plan-${i}`}
                          draggable={!!onEventDrop}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          className={`p-2 rounded-lg ${colors.bg} text-white cursor-pointer hover:opacity-90 transition-opacity ${
                            isDragging ? "opacity-50" : ""
                          } ${onEventDrop ? "cursor-grab active:cursor-grabbing" : ""}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(event);
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {onEventDrop && (
                              <Move size={12} className="opacity-50" />
                            )}
                            <Clock size={12} />
                            <span className="text-sm font-medium truncate">
                              {event.title}
                            </span>
                            {event.has_subtasks && event.subtask_count && (
                              <span className="ml-auto text-xs opacity-75">
                                {event.subtask_completed || 0}/
                                {event.subtask_count}
                              </span>
                            )}
                          </div>
                          {event.estimated_duration && (
                            <div className="text-xs opacity-80 mt-1">
                              预计 {event.estimated_duration} 分钟
                            </div>
                          )}
                          {showSubtasks &&
                            event.subtasks &&
                            event.subtasks.length > 0 && (
                              <div className="mt-2">
                                <CalendarSubtaskStack
                                  subtasks={event.subtasks}
                                  maxVisible={2}
                                  compact={true}
                                  onSubtaskClick={(subtask) => {
                                    onSubtaskClick?.(subtask, event);
                                  }}
                                />
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex-1 space-y-1">
                    {slot.executed.map((exec, i) => (
                      <div
                        key={`exec-${i}`}
                        className={`p-2 rounded-lg border-l-2 border-green-500 ${
                          isDark ? "bg-green-500/10" : "bg-green-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle size={12} className="text-green-500" />
                          <span
                            className={`text-sm font-medium truncate ${
                              isDark ? "text-green-400" : "text-green-700"
                            }`}
                          >
                            {exec.task_title}
                          </span>
                        </div>
                        <div
                          className={`text-xs mt-1 ${isDark ? "text-green-500/70" : "text-green-600"}`}
                        >
                          实际 {Math.round((exec.duration || 0) / 60)} 分钟
                        </div>
                      </div>
                    ))}
                  </div>

                  {dragOverHour === slot.hour && draggedEvent && (
                    <div className="absolute inset-1 flex items-center justify-center z-10">
                      <div
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed ${
                          isDark
                            ? "border-primary-400 text-primary-400"
                            : "border-primary-300 text-primary-500"
                        }`}
                      >
                        <Move size={14} />
                        <span className="text-sm">移动到 {slot.hour}:00</span>
                      </div>
                    </div>
                  )}

                  {hoveredSlot?.hour === slot.hour &&
                    !slot.planned.length &&
                    !slot.executed.length &&
                    !draggedEvent && (
                      <div className="absolute inset-1 flex items-center justify-center">
                        <div
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed ${
                            isDark
                              ? "border-primary-400/50 text-primary-400"
                              : "border-primary-300 text-primary-500"
                          }`}
                        >
                          <Plus size={14} />
                          <span className="text-sm">添加任务</span>
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        )}

        {calendarMode === "history" && (
          <div className="p-4">
            <ActivityTimeline activities={dailyActivities} />
          </div>
        )}
      </div>
    </div>
  );
};
