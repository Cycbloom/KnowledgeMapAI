import React from "react";
import { Brain, RotateCcw, Route, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTheme } from "../../hooks";
import { ActivityEvent, ACTIVITY_TYPE_CONFIG } from "../../types/calendar";

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

function formatDuration(seconds?: number): string {
  if (!seconds) return "";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0
    ? `${hours}小时${remainingMinutes}分钟`
    : `${hours}小时`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  activities,
  onActivityClick,
}) => {
  const { isDark } = useTheme();

  if (activities.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 ${isDark ? "text-slate-500" : "text-gray-400"}`}
      >
        <Clock size={40} className="mb-3 opacity-50" />
        <p className="text-sm">暂无活动记录</p>
      </div>
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
                    {formatDuration(activity.duration)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}
                >
                  {formatTime(activity.started_at)}
                  {activity.ended_at && ` - ${formatTime(activity.ended_at)}`}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${isDark ? colors.bgDark + " " + colors.textDark : colors.bg + " " + colors.text}`}
                >
                  {config?.label || activity.activity_type}
                </span>
              </div>
              {activity.description && (
                <p
                  className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}
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
