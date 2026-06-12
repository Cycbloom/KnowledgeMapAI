import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "../../hooks";
import { CalendarMonthView } from "./CalendarMonthView";
import { CalendarWeekView } from "./CalendarWeekView";
import { CalendarDayView } from "./CalendarDayView";
import { CalendarScheduleView } from "./CalendarScheduleView";
import type { ViewType } from "../../hooks/calendar";
import type {
  CalendarEvent,
  ExecutionEvent,
  EventDropInfo,
  CalendarMode,
  DailyActivityStats,
  ActivityEvent,
} from "../../types/calendar";

interface CalendarContentProps {
  viewType: ViewType;
  currentDate: Date;
  events: CalendarEvent[];
  executions: ExecutionEvent[];
  calendarMode: CalendarMode;
  showSubtasks: boolean;
  activityStats: DailyActivityStats[];
  dailyActivities: ActivityEvent[];
  onDateSelect: (date: Date) => void;
  onEventClick: (event: CalendarEvent) => void;
  onAddEvent: (date: Date, hour?: number) => void;
  onDateChange: (date: Date) => void;
  onEventDrop: (dropInfo: EventDropInfo) => void;
}

export const CalendarContent: React.FC<CalendarContentProps> = ({
  viewType,
  currentDate,
  events,
  executions,
  calendarMode,
  showSubtasks,
  activityStats,
  dailyActivities,
  onDateSelect,
  onEventClick,
  onAddEvent,
  onDateChange,
  onEventDrop,
}) => {
  const { isDark } = useTheme();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={viewType}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        className={`h-full rounded-xl border ${
          isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
        }`}
      >
        {viewType === "month" && (
          <CalendarMonthView
            currentDate={currentDate}
            events={events}
            executions={executions}
            onDateSelect={onDateSelect}
            onEventClick={onEventClick}
            onAddEvent={onAddEvent}
            calendarMode={calendarMode}
            activityStats={activityStats}
            showSubtasks={showSubtasks}
          />
        )}
        {viewType === "week" && (
          <CalendarWeekView
            currentDate={currentDate}
            events={events}
            executions={executions}
            onDateSelect={onDateSelect}
            onEventClick={onEventClick}
            onAddEvent={onAddEvent}
            onEventDrop={onEventDrop}
            showSubtasks={showSubtasks}
          />
        )}
        {viewType === "day" && (
          <CalendarDayView
            currentDate={currentDate}
            events={events}
            executions={executions}
            onEventClick={onEventClick}
            onAddEvent={onAddEvent}
            onEventDrop={onEventDrop}
            calendarMode={calendarMode}
            dailyActivities={dailyActivities}
            showSubtasks={showSubtasks}
          />
        )}
        {viewType === "schedule" && (
          <CalendarScheduleView
            currentDate={currentDate}
            events={events}
            executions={executions}
            onEventClick={onEventClick}
            onAddEvent={onAddEvent}
            onDateChange={onDateChange}
            onEventDrop={onEventDrop}
            calendarMode={calendarMode}
            dailyActivities={dailyActivities}
            showSubtasks={showSubtasks}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
};
