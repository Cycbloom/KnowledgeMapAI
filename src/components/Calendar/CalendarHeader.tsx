import React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Download,
  ListTodo,
} from "lucide-react";
import { useTheme } from "../../hooks";
import type { CalendarMode } from "../../types/calendar";
import type { ViewType } from "../../hooks/calendar";

interface CalendarHeaderProps {
  currentDate: Date;
  viewType: ViewType;
  calendarMode: CalendarMode;
  showSubtasks: boolean;
  onNavigate: (direction: number) => void;
  goToToday: () => void;
  onViewTypeChange: (viewType: ViewType) => void;
  onCalendarModeChange: (mode: CalendarMode) => void;
  onToggleSubtasks: () => void;
  onExport: () => void;
  onAddEvent: (date: Date) => void;
  getTitle: () => string;
}

const VIEW_LABEL_KEYS: Record<ViewType, string> = {
  month: "calendar.month",
  week: "calendar.week",
  day: "calendar.day",
  schedule: "calendar.schedule",
};

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewType,
  calendarMode,
  showSubtasks,
  onNavigate,
  goToToday,
  onViewTypeChange,
  onCalendarModeChange,
  onToggleSubtasks,
  onExport,
  onAddEvent,
  getTitle,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  return (
    <div
      className={`px-4 md:px-6 py-4 border-b ${isDark ? "border-slate-700" : "border-gray-200"}`}
    >
      <div className="flex flex-col gap-4">
        {/* Top row: Title + main controls */}
        <div className="flex items-center justify-between">
          <h1
            className={`text-xl md:text-2xl font-bold ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {t("calendar.title")}
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onAddEvent(currentDate)}
              className="flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors min-h-[44px]"
            >
              <Plus size={18} />
              <span className="hidden md:inline">
                {t("calendar.addTask")}
              </span>
            </button>
          </div>
        </div>

        {/* Navigation controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Date navigation */}
          <div className="flex items-center justify-center md:justify-start gap-2">
            <button
              onClick={() => onNavigate(-1)}
              className={`p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                isDark
                  ? "hover:bg-slate-700 text-slate-400"
                  : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <ChevronLeft size={20} />
            </button>
            <span
              className={`text-base md:text-lg font-medium min-w-[120px] md:min-w-[150px] text-center ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              {getTitle()}
            </span>
            <button
              onClick={() => onNavigate(1)}
              className={`p-3 rounded-lg transition-colors min-h-[44px] min-w-[44px] ${
                isDark
                  ? "hover:bg-slate-700 text-slate-400"
                  : "hover:bg-gray-100 text-gray-500"
              }`}
            >
              <ChevronRight size={20} />
            </button>
            <button
              onClick={goToToday}
              className={`px-4 py-2 text-sm rounded-lg font-medium min-h-[44px] ${
                isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {t("calendar.today")}
            </button>
          </div>

          {/* Right side controls */}
          <div className="flex items-center gap-2 md:gap-3 justify-center md:justify-end overflow-x-auto">
            {/* View type selector */}
            <div
              className={`flex rounded-lg p-1 ${isDark ? "bg-slate-800" : "bg-gray-100"}`}
            >
              {(Object.keys(VIEW_LABEL_KEYS) as ViewType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => onViewTypeChange(type)}
                  className={`px-3 md:px-4 py-2 md:py-1.5 text-sm font-medium rounded-md transition-colors min-h-[44px] flex-shrink-0 ${
                    viewType === type
                      ? "bg-primary-600 text-white"
                      : isDark
                        ? "text-slate-400 hover:text-white"
                        : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {t(VIEW_LABEL_KEYS[type] as never)}
                </button>
              ))}
            </div>

            <div
              className={`flex rounded-lg p-1 ${isDark ? "bg-slate-800" : "bg-gray-100"}`}
            >
              <button
                onClick={() => onCalendarModeChange("plan")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  calendarMode === "plan"
                    ? "bg-primary-600 text-white"
                    : isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t("calendar.plan")}
              </button>
              <button
                onClick={() => onCalendarModeChange("history")}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  calendarMode === "history"
                    ? "bg-primary-600 text-white"
                    : isDark
                      ? "text-slate-400 hover:text-white"
                      : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {t("calendar.history")}
              </button>
            </div>

            {/* Subtasks toggle */}
            {calendarMode === "plan" && (
              <button
                onClick={onToggleSubtasks}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors min-h-[44px] ${
                  showSubtasks
                    ? "bg-primary-600 text-white"
                    : isDark
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
                title={
                  showSubtasks
                    ? t("calendar.hideSubtasks")
                    : t("calendar.showSubtasks")
                }
              >
                <ListTodo size={18} />
                <span className="hidden md:inline">
                  {showSubtasks
                    ? t("calendar.hideSubtasks")
                    : t("calendar.showSubtasks")}
                </span>
              </button>
            )}

            {/* Export button */}
            <button
              onClick={onExport}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors min-h-[44px] ${
                isDark
                  ? "bg-slate-700 text-slate-300 hover:bg-slate-600"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              <Download size={18} />
              <span className="hidden md:inline">{t("calendar.export")}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
