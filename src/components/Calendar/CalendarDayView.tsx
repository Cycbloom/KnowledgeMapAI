import React, { useMemo, useState } from 'react';
import { Plus, Clock, CheckCircle, Move } from 'lucide-react';
import { useTheme } from "../../hooks";
import { CalendarEvent, ExecutionEvent, EventDropInfo } from '../../types/calendar';

interface CalendarDayViewProps {
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date, hour?: number) => void;
  onEventDrop?: (dropInfo: EventDropInfo) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);

export const CalendarDayView: React.FC<CalendarDayViewProps> = ({
  currentDate,
  events,
  executions,
  onEventClick,
  onAddEvent,
  onEventDrop,
}) => {
  const { isDark } = useTheme();
  const [hoveredHour, setHoveredHour] = useState<number | null>(null);
  const [draggedEvent, setDraggedEvent] = useState<CalendarEvent | null>(null);
  const [dragOverHour, setDragOverHour] = useState<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

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
      case 'task':
        return 'bg-primary-500 border-primary-600';
      case 'study':
        return 'bg-primary-500 border-primary-600';
      case 'review':
        return 'bg-green-500 border-green-600';
      default:
        return 'bg-gray-500 border-gray-600';
    }
  };

  const handleDragStart = (e: React.DragEvent, event: CalendarEvent) => {
    setDraggedEvent(event);
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const cellHeight = 80;
    const offsetHours = clickY / cellHeight;
    setDragOffset(offsetHours);
    
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', event.id);
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

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className={`px-4 py-3 border-b ${isDark ? 'border-slate-700' : 'border-gray-200'}`}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-900'}`}>
              {currentDate.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                weekday: 'long',
              })}
            </h3>
            <p className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {dayData.events.length} 个计划任务 · {dayData.executions.length} 个执行记录
            </p>
          </div>
          <button
            onClick={() => onAddEvent(currentDate)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus size={16} />
            添加任务
          </button>
        </div>
      </div>

      {/* Time grid */}
      <div className="flex-1 overflow-y-auto">
        <div className="relative">
          {/* Current time indicator */}
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
              className={`flex min-h-[80px] border-b ${
                isDark ? 'border-slate-700/50' : 'border-gray-100'
              } ${hoveredHour === hour ? 'bg-primary-50/50 dark:bg-primary-500/5' : ''} ${
                dragOverHour === hour ? 'bg-primary-100/50 dark:bg-primary-500/20' : ''
              }`}
              onMouseEnter={() => setHoveredHour(hour)}
              onMouseLeave={() => setHoveredHour(null)}
              onDragOver={(e) => handleDragOver(e, hour)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, hour)}
              onClick={() => !draggedEvent && onAddEvent(currentDate, hour)}
            >
              {/* Time label */}
              <div className="w-16 flex-shrink-0 flex items-start justify-end pr-3 pt-1">
                <span className={`text-sm font-medium ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                  {hour.toString().padStart(2, '0')}:00
                </span>
              </div>

              {/* Content area */}
              <div className="flex-1 relative p-1">
                {/* Planned events */}
                {dayData.eventsByHour[hour]?.map((event, i) => {
                  const isDragging = draggedEvent?.id === event.id;
                  return (
                    <div
                      key={`event-${i}`}
                      draggable={!!onEventDrop}
                      onDragStart={(e) => handleDragStart(e, event)}
                      onDragEnd={handleDragEnd}
                      className={`mb-1 p-2 rounded-lg ${getEventColor(event)} text-white cursor-pointer hover:opacity-90 transition-opacity ${
                        isDragging ? 'opacity-50' : ''
                      } ${onEventDrop ? 'cursor-grab active:cursor-grabbing' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEventClick(event);
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {onEventDrop && <Move size={14} className="opacity-50" />}
                        <Clock size={14} />
                        <span className="font-medium">{event.title}</span>
                      </div>
                      {event.description && (
                        <p className="text-xs opacity-80 mt-1 truncate">{event.description}</p>
                      )}
                    </div>
                  );
                })}

                {/* Execution records */}
                {dayData.executionsByHour[hour]?.map((execution, i) => (
                  <div
                    key={`exec-${i}`}
                    className={`mb-1 p-2 rounded-lg border-l-2 border-green-500 ${
                      isDark ? 'bg-green-500/10' : 'bg-green-50'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle size={14} className="text-green-500" />
                      <span className={`font-medium ${isDark ? 'text-green-400' : 'text-green-700'}`}>
                        {execution.task_title}
                      </span>
                    </div>
                    <div className={`text-xs mt-1 ${isDark ? 'text-green-500/70' : 'text-green-600'}`}>
                      实际用时: {Math.round((execution.duration || 0) / 60)} 分钟
                    </div>
                  </div>
                ))}

                {/* Drop indicator */}
                {dragOverHour === hour && draggedEvent && (
                  <div className="absolute inset-1 flex items-center justify-center">
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed ${
                      isDark
                        ? 'border-primary-400 text-primary-400'
                        : 'border-primary-300 text-primary-500'
                    }`}>
                      <Move size={14} />
                      <span className="text-sm">移动到 {hour}:00</span>
                    </div>
                  </div>
                )}

                {/* Add button on hover */}
                {hoveredHour === hour && !dayData.eventsByHour[hour]?.length && !draggedEvent && (
                  <div className="absolute inset-1 flex items-center justify-center">
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border-2 border-dashed ${
                      isDark
                        ? 'border-primary-400/50 text-primary-400'
                        : 'border-primary-300 text-primary-500'
                    }`}>
                      <Plus size={14} />
                      <span className="text-sm">添加任务</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
