import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { useTheme } from "../../hooks";
import {
  CalendarEvent,
  ExecutionEvent,
  CalendarMode,
  DailyActivityStats,
} from "../../types/calendar";
import { CalendarSubtaskStack } from "./CalendarSubtaskStack";
import type { TaskSubtask } from "@shared/types";

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
  calendarMode?: CalendarMode;
  activityStats?: DailyActivityStats[];
  showSubtasks?: boolean;
  onSubtaskClick?: (subtask: TaskSubtask, parentEvent: CalendarEvent) => void;
}

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  events,
  executions,
  onDateSelect,
  onEventClick,
  onAddEvent,
  calendarMode = "plan",
  activityStats,
  showSubtasks = false,
  onSubtaskClick,
}) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

  const weekdays = useMemo(
    () => [
      t("calendar.weekdays.sun"),
      t("calendar.weekdays.mon"),
      t("calendar.weekdays.tue"),
      t("calendar.weekdays.wed"),
      t("calendar.weekdays.thu"),
      t("calendar.weekdays.fri"),
      t("calendar.weekdays.sat"),
    ],
    [t],
  );

  const monthData = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startPadding = firstDay.getDay();
    const daysInMonth = lastDay.getDate();

    const days: {
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      events: CalendarEvent[];
      executions: ExecutionEvent[];
    }[] = [];

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < startPadding; i++) {
      const date = new Date(year, month, -startPadding + i + 1);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: [],
        executions: [],
      });
    }

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(year, month, i);
      date.setHours(0, 0, 0, 0);

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
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        events: dayEvents,
        executions: dayExecutions,
      });
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      const date = new Date(year, month + 1, i);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: false,
        events: [],
        executions: [],
      });
    }

    return days;
  }, [currentDate, events, executions]);

  const getEventColor = (event: CalendarEvent) => {
    switch (event.type) {
      case "task":
        return "bg-primary-500";
      case "study":
        return "bg-primary-500";
      case "review":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-7 mb-2">
        {weekdays.map((day) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
              isDark ? "text-slate-400" : "text-gray-500"
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 flex-1 gap-1">
        {monthData.map((day, index) => (
          <div
            key={index}
            className={`relative min-h-[80px] p-1 rounded-lg cursor-pointer transition-colors ${
              day.isCurrentMonth
                ? isDark
                  ? "bg-slate-800 hover:bg-slate-700"
                  : "bg-white hover:bg-gray-50"
                : isDark
                  ? "bg-slate-900/50"
                  : "bg-gray-50"
            } ${day.isToday ? "ring-2 ring-primary-500" : ""}`}
            onClick={() => onDateSelect(day.date)}
            onMouseEnter={() => setHoveredDate(day.date)}
            onMouseLeave={() => setHoveredDate(null)}
          >
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-sm font-medium ${
                  day.isToday
                    ? "text-primary-500"
                    : day.isCurrentMonth
                      ? isDark
                        ? "text-white"
                        : "text-gray-900"
                      : isDark
                        ? "text-slate-600"
                        : "text-gray-400"
                }`}
              >
                {day.date.getDate()}
              </span>
              {calendarMode === "plan" &&
                hoveredDate?.getTime() === day.date.getTime() &&
                day.isCurrentMonth && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onAddEvent(day.date);
                    }}
                    className={`p-0.5 rounded ${
                      isDark
                        ? "bg-slate-600 hover:bg-slate-500 text-slate-300"
                        : "bg-gray-200 hover:bg-gray-300 text-gray-600"
                    }`}
                  >
                    <Plus size={12} />
                  </button>
                )}
            </div>

            {calendarMode === "plan" && (
              <div className="space-y-0.5 overflow-hidden">
                {day.events.slice(0, 3).map((event, i) => (
                  <div key={i}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                      className={`${getEventColor(event)} text-white text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80`}
                    >
                      {event.title}
                      {event.has_subtasks && event.subtask_count && (
                        <span className="ml-1 opacity-75">
                          ({event.subtask_completed || 0}/{event.subtask_count})
                        </span>
                      )}
                    </div>
                    {showSubtasks &&
                      event.subtasks &&
                      event.subtasks.length > 0 && (
                        <CalendarSubtaskStack
                          subtasks={event.subtasks}
                          maxVisible={2}
                          compact={true}
                          onSubtaskClick={(subtask) =>
                            onSubtaskClick?.(subtask, event)
                          }
                        />
                      )}
                  </div>
                ))}
                {day.events.length > 3 && (
                  <div
                    className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {t("calendar.moreEvents", { count: day.events.length - 3 })}
                  </div>
                )}
              </div>
            )}

            {calendarMode === "plan" && day.executions.length > 0 && (
              <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span
                  className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}
                >
                  {day.executions.length}
                </span>
              </div>
            )}

            {calendarMode === "history" &&
              activityStats &&
              (() => {
                const dateStr = day.date.toISOString().split("T")[0];
                const stats = activityStats.find((s) => s.date === dateStr);
                if (!stats || stats.activity_count === 0) return null;
                const intensity = Math.min(stats.activity_count / 5, 1);
                return (
                  <div className="mt-1">
                    <div
                      className={`h-1 rounded-full ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
                    >
                      <div
                        className="h-full rounded-full bg-primary-500 transition-all"
                        style={{ width: `${intensity * 100}%` }}
                      />
                    </div>
                    <span
                      className={`text-[10px] ${isDark ? "text-slate-500" : "text-gray-400"}`}
                    >
                      {t("calendar.activitySummary", { count: stats.activity_count, minutes: Math.round(stats.total_duration / 60) })}
                    </span>
                  </div>
                );
              })()}
          </div>
        ))}
      </div>
    </div>
  );
};
