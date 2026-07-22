import React from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../hooks";
import { useStatistics } from "../../hooks/queries";
import { useStore } from "../../store/useStore";
import { Flame, BookOpen } from "lucide-react";

export const HeaderGreeting: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { data: statsData } = useStatistics();
  const { user } = useStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 6) return t('layout.greeting.lateNight');
    if (hour < 12) return t('layout.greeting.morning');
    if (hour < 14) return t('layout.greeting.noon');
    if (hour < 18) return t('layout.greeting.afternoon');
    return t('layout.greeting.evening');
  };

  const userName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || t('layout.greeting.user');
  const dueToday = (statsData as { metrics?: { dueToday?: number } } | null | undefined)?.metrics?.dueToday || 0;
  const rawStreak = user?.user_metadata?.study_streak;
  const streak = typeof rawStreak === 'number' ? rawStreak : 0;

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
          <span className="text-xs font-medium">{t('layout.greeting.streakDays', { count: streak })}</span>
        </div>
      )}

      {dueToday > 0 && (
        <div
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${
            isDark ? "bg-primary-900/30 text-primary-400" : "bg-primary-50 text-primary-600"
          }`}
        >
          <BookOpen size={12} />
          <span className="text-xs font-medium">{t('layout.greeting.dueToday', { count: dueToday })}</span>
        </div>
      )}
    </div>
  );
};
