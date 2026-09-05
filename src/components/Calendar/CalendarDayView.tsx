import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Clock, CheckCircle, Move, Calendar as CalendarIcon } from "lucide-react";
import { useTheme } from "../../hooks";
import {
  CalendarEvent,
  ExecutionEvent,
  EventDropInfo,
  CalendarMode,
  ActivityEvent,
} from "../../types/calendar";
import { ActivityTimeline } from "./ActivityTimeline";
import { CalendarSubtaskStack } from "./CalendarSubtaskStack";
import { formatDate } from "../../utils/formatters";
import type { TaskSubtask } from "@shared/types";

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date, hour?: number) => void;
  onEventDrop?: (dropInfo: EventDropInfo) => void;
  calendarMode?: CalendarMode;
  dailyActivities?: ActivityEvent[];
  showSubtasks?: boolean;
  onSubtaskClick?: (subtask: TaskSubtask, parentEvent: CalendarEvent) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  currentDate,
  events,
  executions,
  onEventClick,
  onAddEvent,
  onEventDrop,
  calendarMode = "plan",
  dailyActivities = [],
  showSubtasks = false,
  onSubtaskClick,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // 键盘拖动相关状态
  const [draggingEventId, setDraggingEventId] = useState<string | null>(null);
  const [dropTargetHour, setDropTargetHour] = useState<number | null>(null);
  const [dragAnnouncement, setDragAnnouncement] = useState<string>("");

  const dayData = useMemo(() => {
    const dateStr = currentDate.toDateString();

    const dayEvents = events.filter((e) => {
      const eventDate = new Date(e.start).toDateString();
      return eventDate === dateStr;
    });

    const dayExecutions = executions.filter((e) => {
      const execDate = new Date(e.started_at).toDateString();
      return execDate === dateStr;
    });

    const eventsByHour: Record<number, CalendarEvent[]> = {};
    const executionsByHour: Record<number, ExecutionEvent[]> = {};

    dayEvents.forEach((event) => {
      const hour = new Date(event.start).getHours();
      if (!eventsByHour[hour]) eventsByHour[hour] = [];
      eventsByHour[hour].push(event);
    });

    dayExecutions.forEach((execution) => {
      const hour = new Date(execution.started_at).getHours();
      if (!executionsByHour[hour]) executionsByHour[hour] = [];
      executionsByHour[hour].push(execution);
    });

    return {
      events: dayEvents,
      executions: dayExecutions,
      eventsByHour,
      executionsByHour,
    };
  }, [currentDate, events, executions]);

  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case "task":
        return "bg-primary-500 border-primary-600";
      case "study":
        return "bg-primary-500 border-primary-600";
      case "review":
        return "bg-green-500 border-green-600";
      case "path_schedule":
        return "bg-purple-500 border-purple-600";
      case "review_projection":
        return "bg-orange-500 border-orange-600";
      default:
        return "bg-gray-500 border-gray-600";
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

  return (
    <div className="h-full flex flex-col">
      <span aria-live="polite" className="sr-only">
        {dragAnnouncement}
      </span>
      <div
        className={`px-4 py-3 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
      >
        <div className="flex items-center justify-between">
          <div>
            <h3
              className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-900"}`}
            >
              {formatDate(currentDate, "long-date")}
            </h3>
            <p
              className={`text-sm ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {calendarMode === "plan"
                ? t("calendar.dayView.plannedAndExecuted", { plannedCount: dayData.events.length, executedCount: dayData.executions.length })
                : t("calendar.dayView.activityLogCount", { count: dailyActivities.length })}
            </p>
          </div>
          {calendarMode === "plan" && (
            <button
              onClick={() => onAddEvent(currentDate)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus size={16} />
              {t("calendar.dayView.addTask")}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {isToday && (
            <div
              className="absolute left-16 right-0 z-20 pointer-events-none"
              style={{
                top: `${currentHour * 80 + (new Date().getMinutes() / 60) * 80 + 40}px`,
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <div className="flex-1 h-0.5 bg-red-500" />
              </div>
            </div>
          )}

          {HOURS.map((hour) => (
            <div
              key={hour}
              role="button"
              aria-label={`${hour.toString().padStart(2, "0")}:00`}
              tabIndex={0}
              className={`flex min-h-[80px] border-b ${
                isDark ? "border-slate-700/50" : "border-gray-100"
              } ${hoveredHour === hour ? "bg-primary-50/50 dark:bg-primary-500/5" : ""} ${
                dragOverHour === hour ||
                (draggingEventId !== null && dropTargetHour === hour)
                  ? "bg-primary-100/50 dark:bg-primary-500/20"
                  : ""
              }`}
              onMouseEnter={() => setHoveredHour(hour)}
              onMouseLeave={() => setHoveredHour(null)}
              onDragOver={(e) => handleDragOver(e, hour)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, hour)}
              onClick={() =>
                !draggedEvent &&
                calendarMode === "plan" &&
                onAddEvent(currentDate, hour)
              }
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && !draggedEvent && calendarMode === "plan") {
                  e.preventDefault();
                  onAddEvent(currentDate, hour);
                }
              }}
            >
              <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1">
                <span
                  className={`text-sm font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
                >
                  {hour.toString().padStart(2, "0")}:00
                </span>
              </div>

              <div className="flex-1 relative p-1">
                {calendarMode === "plan" &&
                  dayData.eventsByHour[hour]?.map((event, i) => {
                    const isDragging = draggedEvent?.id === event.id;
                    const isKeyboardDragging = draggingEventId === event.id;
                    const isEditingDate = editingDateEventId === event.id;
                    return (
                      <div
                        key={`event-${i}`}
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
                        className={`mb-1 p-2 rounded-lg ${getEventColor(event)} text-white cursor-pointer hover:opacity-90 transition-opacity ${
                          isDragging ? "opacity-50" : ""
                        } ${onEventDrop ? "cursor-grab active:cursor-grabbing" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEventClick(event);
                        }}
                      >
                        <div className="flex items-center gap-2">
                          {onEventDrop && (
                            <Move size={14} className="opacity-50" />
                          )}
                          <Clock size={14} />
                          <span className="font-medium">{event.title}</span>
                          {event.has_subtasks && event.subtask_count && (
                            <span className="ml-auto text-xs opacity-75">
                              {event.subtask_completed || 0}/
                              {event.subtask_count} {t("calendar.dayView.subtaskLabel")}
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
                        {event.description && (
                          <p className="text-xs opacity-80 mt-1 truncate">
                            {event.description}
                          </p>
                        )}
                        {showSubtasks &&
                          event.subtasks &&
                          event.subtasks.length > 0 && (
                            <div className="mt-2">
                              <CalendarSubtaskStack
                                subtasks={event.subtasks}
                                maxVisible={3}
                                compact={false}
                                onSubtaskClick={(subtask) => {
                                  onSubtaskClick?.(subtask, event);
                                }}
                              />
                            </div>
                          )}
                      </div>
                    );
                  })}

                {calendarMode === "plan" &&
                  dayData.executionsByHour[hour]?.map((execution, i) => (
                    <div
                      key={`exec-${i}`}
                      className={`mb-1 p-2 rounded-lg border-l-2 border-green-500 ${
                        isDark ? "bg-green-500/10" : "bg-green-50"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <CheckCircle size={14} className="text-green-500" />
                        <span
                          className={`font-medium ${isDark ? "text-green-400" : "text-green-700"}`}
                        >
                          {execution.task_title}
                        </span>
                      </div>
                      <div
                        className={`text-xs mt-1 ${isDark ? "text-green-500/70" : "text-green-600"}`}
                      >
                        {t("calendar.dayView.actualMinutes", { minutes: Math.round((execution.duration || 0) / 60) })}
                      </div>
                    </div>
                  ))}

                {dragOverHour === hour && draggedEvent && (
                  <div className="absolute inset-1 flex items-center justify-center">
                    <div
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed ${
                        isDark
                          ? "border-primary-400 text-primary-400"
                          : "border-primary-300 text-primary-500"
                      }`}
                    >
                      <Move size={14} />
                      <span className="text-sm">{t("calendar.dayView.moveTo", { hour })}</span>
                    </div>
                  </div>
                )}

                {draggingEventId !== null &&
                  dropTargetHour === hour && (
                    <div
                      aria-hidden="true"
                      className="absolute inset-1 flex items-center justify-center pointer-events-none"
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
                          {t("calendar.dayView.moveTo", { hour })}
                        </span>
                      </div>
                    </div>
                  )}

                {calendarMode === "plan" &&
                  hoveredHour === hour &&
                  !dayData.eventsByHour[hour]?.length &&
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
                        <span className="text-sm">{t("calendar.dayView.addTask")}</span>
                      </div>
                    </div>
                  )}
              </div>
            </div>
          ))}
        </div>

        {calendarMode === "history" && dailyActivities.length > 0 && (
          <div
            className={`border-t ${isDark ? "border-slate-700" : "border-gray-200"}`}
          >
            <div
              className={`px-4 py-3 ${isDark ? "bg-slate-800/50" : "bg-gray-50"}`}
            >
              <h4
                className={`text-sm font-medium mb-3 ${isDark ? "text-slate-300" : "text-gray-700"}`}
              >
                {t("calendar.dayView.activityLog")}
              </h4>
              <ActivityTimeline activities={dailyActivities} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
