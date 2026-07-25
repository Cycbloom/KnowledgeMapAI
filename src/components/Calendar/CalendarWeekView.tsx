import React, { useMemo, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Clock, Move, Calendar as CalendarIcon } from "lucide-react";
import { useTheme } from "../../hooks";
import {
  CalendarEvent,
  ExecutionEvent,
  EventDropInfo,
} from "../../types/calendar";
import { CalendarSubtaskStack } from "./CalendarSubtaskStack";
import { formatDate } from "../../utils/formatters";
import type { TaskSubtask } from "@shared/types";

interface CalendarWeekViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date, hour?: number) => void;
  onEventDrop?: (dropInfo: EventDropInfo) => void;
  showSubtasks?: boolean;
  onSubtaskClick?: (subtask: TaskSubtask, parentEvent: CalendarEvent) => void;
}

const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarWeekView: React.FC<CalendarWeekViewProps> = ({
  currentDate,
  events,
  executions,
  onDateSelect,
  onEventClick,
  onAddEvent,
  onEventDrop,
  showSubtasks = false,
  onSubtaskClick,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{
    dayIndex: number;
    hour: number;
  } | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const dragRef = useRef<HTMLDivElement>(null);
  const [editingDateEventId, setEditingDateEventId] = useState<string | null>(
    null,
  );
  const [pendingDateValue, setPendingDateValue] = useState<string>("");

  const weekData = useMemo(() => {
    const days: {
      date: Date;
      label: string;
      isToday: boolean;
      events: CalendarEvent[];
      executions: ExecutionEvent[];
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const startOfWeek = new Date(currentDate);
    startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(date.getDate() + i);

      const dayEvents = events.filter((e) => {
        const eventDate = new Date(e.start);
        eventDate.setHours(0, 0, 0, 0);
        return eventDate.getTime() === date.getTime();
      });

      const dayExecutions = executions.filter((e) => {
        const execDate = new Date(e.started_at);
        execDate.setHours(0, 0, 0, 0);
        return execDate.getTime() === date.getTime();
      });

      days.push({
        date,
        label: `${date.getMonth() + 1}/${date.getDate()}`,
        isToday: date.getTime() === today.getTime(),
        events: dayEvents,
        executions: dayExecutions,
      });
    }

    return days;
  }, [currentDate, events, executions]);

  const getEventPosition = (event: CalendarEvent) => {
    const start = new Date(event.start);
    const end = event.end
      ? new Date(event.end)
      : new Date(start.getTime() + 60 * 60 * 1000);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const duration = endHour - startHour;

    return {
      top: `${startHour * 60}px`,
      height: `${Math.max(duration * 60, 30)}px`,
    };
  };

  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case "task":
        return "bg-primary-500 border-primary-600";
      case "study":
        return "bg-primary-500 border-primary-600";
      case "review":
        return "bg-green-500 border-green-600";
      default:
        return "bg-gray-500 border-gray-600";
    }
  };

  const getExecutionPosition = (execution: ExecutionEvent) => {
    const start = new Date(execution.started_at);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const duration = (execution.duration || 30) / 60;

    return {
      top: `${startHour * 60}px`,
      height: `${Math.max(duration * 60, 20)}px`,
    };
  };

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const offsetHours = clickY / 60;
    setDragOffset(offsetHours);

    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", event.id);

    const dragImage = document.createElement("div");
    dragImage.className = "opacity-50";
    e.dataTransfer.setDragImage(dragImage, 0, 0);
  };

  const handleDragOver = (
    e: React.DragEvent,
    dayIndex: number,
    hour: number,
  ) => {
    e.preventDefault();
    if (draggedEvent) {
      setDragOverCell({ dayIndex, hour });
    }
  };

  const handleDragLeave = () => {
    setDragOverCell(null);
  };

  const handleDrop = (e: React.DragEvent, dayIndex: number, hour: number) => {
    e.preventDefault();

    if (draggedEvent && onEventDrop) {
      const newStart = new Date(weekData[dayIndex].date);
      const adjustedHour = hour - Math.floor(dragOffset);
      newStart.setHours(adjustedHour, (dragOffset % 1) * 60, 0, 0);

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
    setDragOverCell(null);
    setDragOffset(0);
  };

  const handleDragEnd = () => {
    setDraggedEvent(null);
    setDragOverCell(null);
    setDragOffset(0);
  };

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
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      onEventClick(event);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex border-b border-slate-200 dark:border-slate-500">
        <div className="w-16 flex-shrink-0" />
        {weekData.map((day, index) => (
          <div
            key={index}
            className={`flex-1 text-center py-2 border-l border-slate-200 dark:border-slate-500 cursor-pointer ${
              day.isToday ? "bg-primary-50 dark:bg-primary-500/10" : ""
            }`}
            onClick={() => onDateSelect(day.date)}
          >
            <div
              className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              {WEEKDAYS[index]}
            </div>
            <div
              className={`text-sm font-medium ${day.isToday ? "text-primary-500" : isDark ? "text-white" : "text-gray-900"}`}
            >
              {day.label}
            </div>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ minHeight: "1440px" }}>
          {/* Time labels */}
          <div className="w-16 flex-shrink-0">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="h-[60px] text-xs text-right pr-2 text-slate-400"
                style={{ height: "60px" }}
              >
                {hour.toString().padStart(2, "0")}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {weekData.map((day, dayIndex) => (
            <div
              key={dayIndex}
              className={`flex-1 relative border-l border-slate-200 dark:border-slate-500 ${
                day.isToday ? "bg-primary-50/30 dark:bg-primary-500/5" : ""
              }`}
            >
              {/* Hour lines */}
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className={`absolute w-full border-t ${
                    isDark ? "border-slate-700/50" : "border-gray-100"
                  } ${dragOverCell?.dayIndex === dayIndex && dragOverCell?.hour === hour ? "bg-primary-100/50 dark:bg-primary-500/20" : ""}`}
                  style={{ top: `${hour * 60}px`, height: "60px" }}
                  onDragOver={(e) => handleDragOver(e, dayIndex, hour)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, dayIndex, hour)}
                  onClick={() => !draggedEvent && onAddEvent(day.date, hour)}
                />
              ))}

              {/* Executions (background) */}
              {day.executions.map((execution, i) => {
                const position = getExecutionPosition(execution);
                return (
                  <div
                    key={`exec-${i}`}
                    className="absolute left-1 right-1 bg-green-200/50 dark:bg-green-500/20 border-l-2 border-green-500 rounded-r"
                    style={position}
                    title={`${execution.task_title} - ${Math.round((execution.duration || 0) / 60)}分钟`}
                  >
                    <div className="p-1 text-xs text-green-700 dark:text-green-300 truncate">
                      ✓ {execution.task_title}
                    </div>
                  </div>
                );
              })}

              {/* Events (foreground) */}
              {day.events.map((event, i) => {
                const position = getEventPosition(event);
                const isDragging = draggedEvent?.id === event.id;
                const hasEnoughHeight =
                  position.height && parseInt(position.height) > 80;
                const isEditingDate = editingDateEventId === event.id;
                return (
                  <div
                    key={`event-${i}`}
                    ref={dragRef}
                    draggable={!!onEventDrop && !isEditingDate}
                    onDragStart={(e) => handleDragStart(e, event)}
                    onDragEnd={handleDragEnd}
                    role="button"
                    tabIndex={0}
                    aria-roledescription={t("calendar.a11y.draggableTask")}
                    aria-label={`${event.title}, ${formatDate(event.start, "long-date")}`}
                    aria-grabbed={isDragging ? "true" : "false"}
                    onKeyDown={(e) => handleCardKeyDown(e, event)}
                    className={`absolute left-1 right-1 ${getEventColor(event)} text-white rounded shadow-sm cursor-pointer hover:opacity-90 overflow-hidden ${
                      isDragging ? "opacity-50" : ""
                    } ${onEventDrop ? "cursor-grab active:cursor-grabbing" : ""}`}
                    style={position}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick(event);
                    }}
                  >
                    <div className="p-1 text-xs font-medium truncate flex items-center gap-1">
                      {onEventDrop && <Move size={10} className="opacity-50" />}
                      {event.title}
                      {event.has_subtasks && event.subtask_count && (
                        <span className="ml-auto opacity-75 text-[10px]">
                          {event.subtask_completed || 0}/{event.subtask_count}
                        </span>
                      )}
                      {onEventDrop && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenChangeDate(event);
                          }}
                          className={`p-0.5 rounded hover:bg-white/20 focus:outline-none focus:ring-1 focus:ring-white/50 flex-shrink-0 ${
                            event.has_subtasks && event.subtask_count
                              ? ""
                              : "ml-auto"
                          }`}
                          aria-label={t("calendar.a11y.changeDate")}
                          title={t("calendar.a11y.changeDate")}
                        >
                          <CalendarIcon size={10} />
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
                        className="mx-1 mb-1 text-xs text-slate-900 bg-white rounded px-1 py-0.5 w-[calc(100%-0.5rem)]"
                        aria-label={t("calendar.a11y.changeDate")}
                      />
                    )}
                    {position.height && parseInt(position.height) > 40 && (
                      <div className="px-1 text-xs opacity-80 flex items-center gap-1">
                        <Clock size={10} />
                        {formatDate(event.start, "time")}
                      </div>
                    )}
                    {showSubtasks &&
                      hasEnoughHeight &&
                      event.subtasks &&
                      event.subtasks.length > 0 && (
                        <div className="px-1 pb-1">
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

              {/* Drop indicator */}
              {dragOverCell?.dayIndex === dayIndex && draggedEvent && (
                <div
                  className="absolute left-1 right-1 bg-primary-400/30 border-2 border-primary-400 border-dashed rounded pointer-events-none"
                  style={{
                    top: `${(dragOverCell.hour - Math.floor(dragOffset)) * 60}px`,
                    height: `${getEventPosition(draggedEvent).height}`,
                  }}
                >
                  <div className="flex items-center justify-center h-full text-primary-500 text-xs font-medium">
                    <Move size={14} className="mr-1" />
                    移动到 {dragOverCell.hour}:00
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
