import React from "react";
import { useTheme } from "../../hooks";
import { useStatistics } from "../../hooks/queries";
import { useStore } from "../../store/useStore";
import { Flame, BookOpen } from "lucide-react";

export const HeaderGreeting: React.FC = () => {
  const { isDark } = useTheme();
  const { data: statsData } = useStatistics();
  const { user } = useStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return "夜深了";
    if (hour < 12) return "早上好";
    if (hour < 14) return "中午好";
    if (hour < 18) return "下午好";
    return "晚上好";
  };

  const userName =
    (user?.user_metadata as any)?.name || user?.email?.split("@")[0] || "用户";
  const dueToday = statsData?.metrics?.dueToday || 0;
  const streak = (user?.user_metadata as any)?.study_streak || 0;

  return (
    <div className="flex items-center gap-4 text-sm">
      <span className={isDark ? "text-slate-300" : "text-gray-700"}>
        {getGreeting()}，<span className="font-medium">{userName}</span>
      </span>

      {streak > 0 && (
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
            isDark
              ? "bg-orange-900/30 text-orange-400"
              : "bg-orange-50 text-orange-600"
          }`}
        >
          <Flame size={12} />
          <span className="text-xs font-medium">连续 {streak} 天</span>
        </div>
      )}

      {dueToday > 0 && (
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
            isDark ? "bg-blue-900/30 text-blue-400" : "bg-blue-50 text-blue-600"
          }`}
        >
          <BookOpen size={12} />
          <span className="text-xs font-medium">今日 {dueToday} 张</span>
        </div>
      )}
    </div>
  );
};
