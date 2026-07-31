import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Calendar,
  CalendarClock,
  Clock,
  Target,
  TrendingUp,
  Flame,
  Award,
  ChevronLeft,
  ChevronRight,
  BarChart3,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from '../../services/api';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { formatDuration, formatDate } from '../../utils/formatters';
import type {MonthlyFocusStats} from '@shared/types';

interface MonthlyReportProps {
  year?: number;
  month?: number;
  className?: string;
}

const MONTH_KEYS = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
] as const;

export const MonthlyReport: React.FC<MonthlyReportProps> = ({
  year,
  month,
  className = "",
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<MonthlyFocusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState(
    year ?? new Date().getFullYear(),
  );
  const [currentMonth, setCurrentMonth] = useState(
    month ?? new Date().getMonth() + 1,
  );
  const [retryCount, setRetryCount] = useState(0);

  const getMonthName = useCallback(
    (monthIndex: number): string => {
      const key = MONTH_KEYS[monthIndex - 1] ?? MONTH_KEYS[0];
      return t(`scheduler.monthlyReport.months.${key}`);
    },
    [t],
  );

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await api.scheduler.getMonthlyFocusStats(
          currentYear,
          currentMonth,
        );
        setStats(stats);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch monthly stats:", err);
        setError(t('scheduler.reports.loadMonthlyFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentYear, currentMonth, retryCount, t]);

  const navigateMonth = (direction: "prev" | "next") => {
    if (direction === "prev") {
      if (currentMonth === 1) {
        setCurrentMonth(12);
        setCurrentYear(currentYear - 1);
      } else {
        setCurrentMonth(currentMonth - 1);
      }
    } else {
      if (currentMonth === 12) {
        setCurrentMonth(1);
        setCurrentYear(currentYear + 1);
      } else {
        setCurrentMonth(currentMonth + 1);
      }
    }
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${className}`}>
        <ErrorState
          message={error}
          onRetry={() => {
            setError(null);
            setRetryCount((c) => c + 1);
          }}
        />
      </div>
    );
  }

  if (!stats) return null;

  const totalHours = stats.total_duration / 3600;
  const avgHoursPerDay = stats.daily_average / 3600;

  return (
    <div className={`p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Calendar size={20} className="text-pink-500" />
            {t("scheduler.monthlyReport.title")}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t("scheduler.monthlyReport.yearMonthFormat", {
              year: currentYear,
              month: getMonthName(currentMonth),
            })}
          </p>
        </motion.div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateMonth("prev")}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => navigateMonth("next")}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-500/5 border border-primary-200 dark:border-primary-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-primary-500" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {t("scheduler.monthlyReport.totalFocusDuration")}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {totalHours.toFixed(1)}
            <span className="text-sm font-normal text-slate-500 ml-1">
              {t("scheduler.monthlyReport.hourUnit")}
            </span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-200 dark:border-emerald-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-emerald-500" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {t("scheduler.monthlyReport.completedTasks")}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.tasks_completed}
            <span className="text-sm font-normal text-slate-500 ml-1">{t("scheduler.monthlyReport.countUnit")}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-violet-500/5 border border-violet-200 dark:border-violet-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp size={16} className="text-violet-500" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {t("scheduler.monthlyReport.activeDays")}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.active_days}
            <span className="text-sm font-normal text-slate-500 ml-1">{t("scheduler.monthlyReport.dayUnit")}</span>
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-200 dark:border-amber-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame size={16} className="text-amber-500" />
            <span className="text-xs text-slate-600 dark:text-slate-300">
              {t("scheduler.monthlyReport.longestStreak")}
            </span>
          </div>
          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {stats.streak_longest}
            <span className="text-sm font-normal text-slate-500 ml-1">{t("scheduler.monthlyReport.dayUnit")}</span>
          </p>
        </motion.div>
      </div>

      {stats.best_day.date && stats.best_day.duration > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="p-4 rounded-xl bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-200 dark:border-pink-800/50 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                <Award size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {t("scheduler.monthlyReport.bestPerformanceDay")}
                </p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {formatDate(stats.best_day.date, "month-day")}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">
                {formatDuration(stats.best_day.duration, { format: 'compact', emptyText: '0m' })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("scheduler.monthlyReport.focusDuration")}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500/50"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 size={18} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
            {t("scheduler.monthlyReport.weeklyDistribution")}
          </span>
        </div>

        <div className="space-y-3">
          {stats.weekly_breakdown.map((week, index) => {
            const weekHours = week.duration / 3600;
            const maxWeekHours = Math.max(
              ...stats.weekly_breakdown.map((w) => w.duration / 3600),
              1,
            );
            const percentage = (weekHours / maxWeekHours) * 100;

            return (
              <div key={week.week} className="flex items-center gap-3">
                <span className="text-xs text-slate-500 dark:text-slate-400 w-12">
                  {t("scheduler.monthlyReport.weekFormat", { week: week.week })}
                </span>
                <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden relative">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ delay: 0.7 + index * 0.1, duration: 0.5 }}
                    className="h-full bg-gradient-to-r from-primary-500 to-violet-500 rounded-full"
                  />
                  <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs font-medium text-slate-700 dark:text-slate-200">
                    {weekHours.toFixed(1)}h
                  </span>
                </div>
                <span className="text-xs text-slate-500 dark:text-slate-400 w-16 text-right">
                  {t("scheduler.monthlyReport.sessionCountFormat", { count: week.sessions })}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-500/30"
      >
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("scheduler.monthlyReport.dailyAvgDuration")}
            </p>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {avgHoursPerDay.toFixed(1)}h
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("scheduler.monthlyReport.totalPomodoros")}
            </p>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {stats.total_pomodoros}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("scheduler.monthlyReport.totalSessions")}</p>
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              {stats.total_sessions}
            </p>
          </div>
        </div>
      </motion.div>

      {stats.total_duration === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="mt-6"
        >
          <EmptyState
            icon={<CalendarClock className="w-12 h-12 text-gray-400" />}
            title={t('scheduler.monthlyReport.empty')}
            description={t('scheduler.monthlyReport.emptyHint')}
          />
        </motion.div>
      )}
    </div>
  );
};
