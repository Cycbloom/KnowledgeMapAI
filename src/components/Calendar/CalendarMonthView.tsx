import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { CalendarEvent, ExecutionEvent } from '../../types/calendar';

interface CalendarMonthViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date) => void;
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  currentDate,
  events,
  executions,
  onDateSelect,
  onEventClick,
  onAddEvent,
}) => {
  const { isDark } = useTheme();
  const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

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
      case 'task':
        return 'bg-blue-500';
      case 'study':
        return 'bg-purple-500';
      case 'review':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-2">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className={`text-center text-sm font-medium py-2 ${
              isDark ? 'text-slate-400' : 'text-gray-500'
            }`}
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1 gap-1">
        {monthData.map((day, index) => (
          <div
            key={index}
            className={`relative min-h-[80px] p-1 rounded-lg cursor-pointer transition-colors ${
              day.isCurrentMonth
                ? isDark
                  ? 'bg-slate-800 hover:bg-slate-700'
                  : 'bg-white hover:bg-gray-50'
                : isDark
                  ? 'bg-slate-900/50'
                  : 'bg-gray-50'
            } ${day.isToday ? 'ring-2 ring-blue-500' : ''}`}
            onClick={() => onDateSelect(day.date)}
            onMouseEnter={() => setHoveredDate(day.date)}
            onMouseLeave={() => setHoveredDate(null)}
          >
            {/* Date number */}
            <div className="flex items-center justify-between mb-1">
              <span
                className={`text-sm font-medium ${
                  day.isToday
                    ? 'text-blue-500'
                    : day.isCurrentMonth
                      ? isDark
                        ? 'text-white'
                        : 'text-gray-900'
                      : isDark
                        ? 'text-slate-600'
                        : 'text-gray-400'
                }`}
              >
                {day.date.getDate()}
              </span>
              {hoveredDate?.getTime() === day.date.getTime() && day.isCurrentMonth && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onAddEvent(day.date);
                  }}
                  className={`p-0.5 rounded ${
                    isDark
                      ? 'bg-slate-600 hover:bg-slate-500 text-slate-300'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-600'
                  }`}
                >
                  <Plus size={12} />
                </button>
              )}
            </div>

            {/* Events */}
            <div className="space-y-0.5 overflow-hidden">
              {day.events.slice(0, 3).map((event, i) => (
                <div
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick(event);
                  }}
                  className={`${getEventColor(event)} text-white text-xs px-1 py-0.5 rounded truncate cursor-pointer hover:opacity-80`}
                >
                  {event.title}
                </div>
              ))}
              {day.events.length > 3 && (
                <div className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  +{day.events.length - 3} 更多
                </div>
              )}
            </div>

            {/* Execution indicator */}
            {day.executions.length > 0 && (
              <div className="absolute bottom-1 right-1 flex items-center gap-0.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  {day.executions.length}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
