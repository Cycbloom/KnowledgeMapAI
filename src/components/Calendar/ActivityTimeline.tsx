import React from "react";
import { useTranslation } from "react-i18next";
import { Brain, RotateCcw, Route, Clock, type LucideIcon } from "lucide-react";
import { useTheme } from "../../hooks";
import { formatDuration, formatDate } from "../../utils/formatters";
import { ActivityEvent, ACTIVITY_TYPE_CONFIG } from "../../types/calendar";
import { EmptyState } from "../common/EmptyState";

interface ActivityTimelineProps {
  activities: ActivityEvent[];
  onActivityClick?: (activity: ActivityEvent) => void;
}

const ICON_MAP: Record<string, LucideIcon> = {
  Brain,
  RotateCcw,
  Route,
};

const COLOR_MAP: Record<
  string,
  { bg: string; bgDark: string; text: string; textDark: string; dot: string }
> = {
  purple: {
    bg: "bg-purple-100",
    bgDark: "bg-purple-900/30",
    text: "text-purple-700",
    textDark: "text-purple-300",
    dot: "bg-purple-500",
  },
  green: {
    bg: "bg-green-100",
    bgDark: "bg-green-900/30",
    text: "text-green-700",
    textDark: "text-green-300",
    dot: "bg-green-500",
  },
  indigo: {
    bg: "bg-indigo-100",
    bgDark: "bg-indigo-900/30",
    text: "text-indigo-700",
    textDark: "text-indigo-300",
    dot: "bg-indigo-500",
  },
};

function formatTime(dateStr: string): string {
  return formatDate(dateStr, "time");
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  onActivityClick,
}) => {
  const { isDark } = useTheme();
  const { t } = useTranslation();

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<Clock size={40} className="text-gray-400 dark:text-gray-500" />}
        title={t("calendar.noActivityTitle")}
        description={t("calendar.noActivityDesc")}
      />
    );
  }

  return (
    <div className="relative">
      {activities.map((activity, index) => {
        const config = ACTIVITY_TYPE_CONFIG[activity.activity_type];
        const IconComponent = ICON_MAP[config?.icon || "Clock"] || Clock;
        const colors = COLOR_MAP[config?.color || "blue"] || COLOR_MAP.blue;

        return (
          <div key={activity.id} className="relative flex gap-3 pb-4">
            {index < activities.length - 1 && (
              <div
                className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${isDark ? "bg-slate-700" : "bg-gray-200"}`}
              />
            )}

            <div
              className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${isDark ? colors.bgDark : colors.bg} z-10`}
            >
              <div className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
            </div>

            <div
              className={`flex-1 rounded-lg p-3 cursor-pointer transition-colors ${isDark ? "bg-slate-800 hover:bg-slate-700" : "bg-white hover:bg-gray-50 border border-gray-100"}`}
              onClick={() => onActivityClick?.(activity)}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <IconComponent
                    size={14}
                    className={isDark ? colors.textDark : colors.text}
                  />
                  <span
                    className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}
                  >
                    {activity.title}
                  </span>
                </div>
                {activity.duration != null && (
                  <span
                    className={`text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
                  >
                    {formatDuration(activity.duration, { emptyText: "" })}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${isDark ? "text-slate-500" : "text-gray-600"}`}
                >
                  {formatTime(activity.started_at)}
                  {activity.ended_at && ` - ${formatTime(activity.ended_at)}`}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${isDark ? `${colors.bgDark  } ${  colors.textDark}` : `${colors.bg  } ${  colors.text}`}`}
                >
                  {config?.label || activity.activity_type}
                </span>
              </div>
              {activity.description && (
                <p
                  className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-600"}`}
                >
                  {activity.description}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
