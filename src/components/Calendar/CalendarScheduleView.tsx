import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Plus,
  Clock,
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Move,
  Calendar as CalendarIcon,
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

  // 键盘拖动相关状态
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTargetHour, setDropTargetHour] = useState<number | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState<string>("");

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

    // 预按小时分桶，避免为每个小时 filter 全量 dayEvents/dayExecutions（原为 O(24*(n+m))）
    const eventsByHour = new Map<number, CalendarEvent[]>();
    dayEvents.forEach((e) => {
      const hour = new Date(e.start).getHours();
      const list = eventsByHour.get(hour);
      if (list) {
        list.push(e);
      } else {
        eventsByHour.set(hour, [e]);
      }
    });
    const execByHour = new Map<number, ExecutionEvent[]>();
    dayExecutions.forEach((e) => {
      const hour = new Date(e.started_at).getHours();
      const list = execByHour.get(hour);
      if (list) {
        list.push(e);
      } else {
        execByHour.set(hour, [e]);
      }
    });

    const slots: {
      hour: number;
      planned: CalendarEvent[];
      executed: ExecutionEvent[];
    }[] = HOURS.map((hour) => {
      return {
        hour,
        planned: eventsByHour.get(hour) || [],
        executed: execByHour.get(hour) || [],
      };
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

    // 利用 hour 分桶缩小候选集：exec 命中目标必在前后 1 小时桶内，替代对全量 dayEvents 的 O(m) 扫描
    const matchedExecutions = dayExecutions.filter((exec) => {
      const execStart = new Date(exec.started_at);
      const execHour = execStart.getHours();
      const candidates = [
        ...(eventsByHour.get((execHour - 1 + 24) % 24) || []),
        ...(eventsByHour.get(execHour) || []),
        ...(eventsByHour.get((execHour + 1) % 24) || []),
      ];
      return candidates.some((event) => {
        const eventStart = new Date(event.start);
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
      case "path_schedule":
        return {
          bg: "bg-purple-500",
          border: "border-purple-600",
          light: "bg-purple-100 dark:bg-purple-500/20",
        };
      case "review_projection":
        return {
          bg: "bg-orange-500",
          border: "border-orange-600",
          light: "bg-orange-100 dark:bg-orange-500/20",
        };
      case "stage_window":
        return {
          bg: "bg-indigo-500",
          border: "border-indigo-600",
          light: "bg-indigo-100 dark:bg-indigo-500/20",
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

  const [editingDateEventId, setEditingDateEventId] = useState<string | null>(
    null,
  );
  const [pendingDateValue, setPendingDateValue] = useState<string>("");

  const toDateInputValue = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const handleOpenChangeDate = (event: CalendarEvent) => {
    setEditingDateEventId(event.id);
    setPendingDateValue(toDateInputValue(new Date(event.start)));
  };

  const handleDateInputChange = (
    event: CalendarEvent,
    newValue: string,
  ) => {
    if (!newValue) {
      setEditingDateEventId(null);
      return;
    }
    if (!onEventDrop) {
      setEditingDateEventId(null);
      return;
    }
    const parts = newValue.split("-");
    if (parts.length !== 3) {
      setEditingDateEventId(null);
      return;
    }
    const year = parseInt(parts[0] ?? "0", 10);
    const month = parseInt(parts[1] ?? "0", 10) - 1;
    const day = parseInt(parts[2] ?? "0", 10);

    const originalStart = new Date(event.start);
    const newStart = new Date(originalStart);
    newStart.setFullYear(year, month, day);

    const originalEnd = event.end ? new Date(event.end) : null;
    let newEnd: Date | undefined;
    if (originalEnd) {
      const duration = originalEnd.getTime() - originalStart.getTime();
      newEnd = new Date(newStart.getTime() + duration);
    }

    onEventDrop({
      eventId: event.id,
      newStart,
      newEnd,
    });
    setEditingDateEventId(null);
  };

  const handleCardKeyDown = (
    e: React.KeyboardEvent,
    event: CalendarEvent,
  ) => {
    // 当前正有事件处于键盘拖动模式
    if (draggingEventId !== null) {
      // 其他事件正在被拖动：忽略
      if (draggingEventId !== event.id) {
        return;
      }

      if (e.key === "ArrowUp" && dropTargetHour !== null) {
        e.preventDefault();
        const newHour = Math.max(0, dropTargetHour - 1);
        setDropTargetHour(newHour);
        setDragAnnouncement(
          `${t("calendar.drag.targetHour", { hour: newHour })}. ${t("calendar.drag.moveHint")}`,
        );
      } else if (e.key === "ArrowDown" && dropTargetHour !== null) {
        e.preventDefault();
        const newHour = Math.min(23, dropTargetHour + 1);
        setDropTargetHour(newHour);
        setDragAnnouncement(
          `${t("calendar.drag.targetHour", { hour: newHour })}. ${t("calendar.drag.moveHint")}`,
        );
      } else if (e.key === "Enter" && dropTargetHour !== null) {
        e.preventDefault();
        e.stopPropagation();
        if (onEventDrop) {
          const newStart = new Date(currentDate);
          newStart.setHours(dropTargetHour, 0, 0, 0);

          const originalStart = new Date(event.start);
          const originalEnd = event.end ? new Date(event.end) : null;
          let newEnd: Date | undefined;
          if (originalEnd) {
            const duration = originalEnd.getTime() - originalStart.getTime();
            newEnd = new Date(newStart.getTime() + duration);
          }

          onEventDrop({
            eventId: event.id,
            newStart,
            newEnd,
          });
        }
        setDragAnnouncement(
          t("calendar.drag.confirm", { hour: dropTargetHour }),
        );
        setDraggingEventId(null);
        setDropTargetHour(null);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setDraggingEventId(null);
        setDropTargetHour(null);
        setDragAnnouncement(t("calendar.drag.cancel"));
      }
      return;
    }

    // 非拖动模式：Ctrl+Space / Shift+Space 进入键盘拖动模式
    if (
      (e.key === " " && (e.ctrlKey || e.shiftKey)) &&
      onEventDrop
    ) {
      e.preventDefault();
      e.stopPropagation();
      const startHour = new Date(event.start).getHours();
      setDraggingEventId(event.id);
      setDropTargetHour(startHour);
      setDragAnnouncement(
        `${t("calendar.drag.start", { title: event.title, hour: startHour })}. ${t("calendar.drag.moveHint")}`,
      );
      return;
    }

    // 默认行为：Enter/Space 触发点击
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onEventClick(event);
    }
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
      <span aria-live="polite" className="sr-only">
        {dragAnnouncement}
      </span>
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
                {t("calendar.today")}
              </button>
            )}
          </div>

          {calendarMode === "plan" && (
            <button
              onClick={() => onAddEvent(currentDate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              {t("calendar.scheduleView.addTask")}
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
                {t("calendar.scheduleView.labels.planned")} {formatDurationMinutes(scheduleData.stats.plannedMinutes, { emptyText: t("calendar.scheduleView.emptyDuration") })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {t("calendar.scheduleView.labels.actual")} {formatDurationMinutes(scheduleData.stats.executedMinutes, { emptyText: t("calendar.scheduleView.emptyDuration") })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle size={14} className="text-green-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {t("calendar.scheduleView.labels.matchRate")} {scheduleData.stats.matchRate}%
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
                {t("calendar.scheduleView.activityLogCount", { count: dailyActivities.length })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-primary-500" />
              <span
                className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {t("calendar.scheduleView.labels.totalDuration")}{" "}
                {formatDurationMinutes(
                  Math.round(
                    dailyActivities.reduce(
                      (acc, a) => acc + (a.duration || 0),
                      0,
                    ) / 60,
                  ),
                  { emptyText: t("calendar.scheduleView.emptyDuration") },
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
                role="button"
                aria-label={`${slot.hour.toString().padStart(2, "0")}:00`}
                tabIndex={0}
                className={`flex h-[80px] border-b ${
                  isDark ? "border-slate-700/50" : "border-gray-100"
                } ${hoveredSlot?.hour === slot.hour ? "bg-primary-50/50 dark:bg-primary-500/5" : ""} ${
                  dragOverHour === slot.hour ||
                  (draggingEventId !== null && dropTargetHour === slot.hour)
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
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && !draggedEvent) {
                    e.preventDefault();
                    onAddEvent(currentDate, slot.hour);
                  }
                }}
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
                      const isKeyboardDragging = draggingEventId === event.id;
                      const isEditingDate = editingDateEventId === event.id;
                      return (
                        <div
                          key={`plan-${i}`}
                          draggable={!!onEventDrop && !isEditingDate}
                          onDragStart={(e) => handleDragStart(e, event)}
                          onDragEnd={handleDragEnd}
                          role="button"
                          tabIndex={0}
                          aria-roledescription={t("calendar.a11y.draggableTask")}
                          aria-label={event.title}
                          aria-grabbed={
                            isDragging || isKeyboardDragging ? "true" : "false"
                          }
                          onKeyDown={(e) => handleCardKeyDown(e, event)}
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
                            {onEventDrop && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenChangeDate(event);
                                }}
                                className={`p-0.5 rounded hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50 ${
                                  event.has_subtasks && event.subtask_count
                                    ? ""
                                    : "ml-auto"
                                }`}
                                aria-label={t("calendar.a11y.changeDate")}
                                title={t("calendar.a11y.changeDate")}
                              >
                                <CalendarIcon size={12} />
                              </button>
                            )}
                          </div>
                          {isEditingDate && (
                            <input
                              type="date"
                              value={pendingDateValue}
                              onChange={(e) =>
                                handleDateInputChange(event, e.target.value)
                              }
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => e.stopPropagation()}
                              className="mt-1 text-xs text-slate-900 bg-white rounded px-1 py-0.5"
                              aria-label={t("calendar.a11y.changeDate")}
                            />
                          )}
                          {event.estimated_duration && (
                            <div className="text-xs opacity-80 mt-1">
                              {t("calendar.scheduleView.estimatedMinutes", { minutes: event.estimated_duration })}
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
                          {t("calendar.scheduleView.actualMinutes", { minutes: Math.round((exec.duration || 0) / 60) })}
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
                        <span className="text-sm">{t("calendar.scheduleView.moveTo", { hour: slot.hour })}</span>
                      </div>
                    </div>
                  )}

                  {draggingEventId !== null &&
                    dropTargetHour === slot.hour && (
                      <div
                        aria-hidden="true"
                        className="absolute inset-1 flex items-center justify-center z-10 pointer-events-none"
                      >
                        <div
                          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed ${
                            isDark
                              ? "border-primary-400 text-primary-400"
                              : "border-primary-300 text-primary-500"
                          }`}
                        >
                          <Move size={14} />
                          <span className="text-sm">
                            {t("calendar.scheduleView.moveTo", { hour: slot.hour })}
                          </span>
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
                          <span className="text-sm">{t("calendar.scheduleView.addTask")}</span>
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
