import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar,
  CalendarClock,
  Clock,
  Target,
  TrendingUp,
  Flame,
  Award,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { formatDuration, formatDate } from '../../utils/formatters';
import type {WeeklyFocusStats} from '@shared/types';

interface WeeklyReportProps {
  weekStart?: string;
  className?: string;
}

export const WeeklyReport: React.FC<WeeklyReportProps> = ({ weekStart, className = '' }) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<WeeklyFocusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState<string | undefined>(weekStart);
  const [retryCount, setRetryCount] = useState(0);

  const weekdays = [
    t('scheduler.weeklyReport.weekdaySun'),
    t('scheduler.weeklyReport.weekdayMon'),
    t('scheduler.weeklyReport.weekdayTue'),
    t('scheduler.weeklyReport.weekdayWed'),
    t('scheduler.weeklyReport.weekdayThu'),
    t('scheduler.weeklyReport.weekdayFri'),
    t('scheduler.weeklyReport.weekdaySat'),
  ];

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await api.scheduler.getWeeklyFocusStats(currentWeekStart);
        setStats(stats);
        setError(null);
      } catch (err) {
        console.error('Failed to fetch weekly stats:', err);
        setError(t('scheduler.reports.loadWeeklyFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [currentWeekStart, retryCount, t]);

  const navigateWeek = (direction: 'prev' | 'next') => {
    if (!stats) return;
    const current = new Date(currentWeekStart || stats.week_start);
    current.setDate(current.getDate() + (direction === 'prev' ? -7 : 7));
    setCurrentWeekStart(current.toISOString().split('T')[0]);
  };

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-200 dark:bg-slate-700 rounded-xl" />
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

  const weekStartDate = new Date(stats.week_start);
  const weekEndDate = new Date(stats.week_end);
  const weekRange = t('scheduler.weeklyReport.weekRange', {
    startMonth: weekStartDate.getMonth() + 1,
    startDay: weekStartDate.getDate(),
    endMonth: weekEndDate.getMonth() + 1,
    endDay: weekEndDate.getDate(),
  });

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
            <Calendar size={20} className="text-violet-500" />
            {t('scheduler.weeklyReport.title')}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{weekRange}</p>
        </motion.div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={() => navigateWeek('next')}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400 transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-4 rounded-xl bg-gradient-to-br from-primary-500/10 to-primary-500/5 border border-primary-200 dark:border-primary-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Clock size={18} className="text-primary-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('scheduler.weeklyReport.stat.totalFocusDuration')}</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {totalHours.toFixed(1)}
            <span className="text-lg font-normal text-slate-500 ml-1">{t('scheduler.weeklyReport.stat.hours')}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('scheduler.weeklyReport.stat.dailyAverage', { hours: avgHoursPerDay.toFixed(1) })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-4 rounded-xl bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-200 dark:border-emerald-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Target size={18} className="text-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('scheduler.weeklyReport.stat.completion')}</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {stats.tasks_completed}
            <span className="text-lg font-normal text-slate-500 ml-1">{t('scheduler.weeklyReport.stat.tasks')}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('scheduler.weeklyReport.stat.focusSessions', { count: stats.total_sessions })}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-4 rounded-xl bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-200 dark:border-amber-800/50"
        >
          <div className="flex items-center gap-2 mb-2">
            <Flame size={18} className="text-amber-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">{t('scheduler.weeklyReport.stat.streakDays')}</span>
          </div>
          <p className="text-3xl font-bold text-slate-900 dark:text-white">
            {stats.streak_days}
            <span className="text-lg font-normal text-slate-500 ml-1">{t('scheduler.weeklyReport.stat.days')}</span>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {t('scheduler.weeklyReport.stat.pomodoros', { count: stats.total_pomodoros })}
          </p>
        </motion.div>
      </div>

      {stats.best_day.date && stats.best_day.duration > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="p-4 rounded-xl bg-gradient-to-r from-violet-500/10 to-pink-500/10 border border-violet-200 dark:border-violet-800/50 mb-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500">
                <Award size={20} className="text-white" />
              </div>
              <div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{t('scheduler.weeklyReport.bestDay.title')}</p>
                <p className="text-lg font-semibold text-slate-900 dark:text-white">
                  {weekdays[new Date(stats.best_day.date).getDay()]} · {formatDate(stats.best_day.date, 'month-day')}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                {formatDuration(stats.best_day.duration, { format: 'compact', emptyText: '0m' })}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{t('scheduler.weeklyReport.bestDay.focusDuration')}</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500/50"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={18} className="text-slate-500" />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t('scheduler.weeklyReport.weekOverview')}</span>
        </div>
        <div className="grid grid-cols-7 gap-2">
          {weekdays.map((day, index) => {
            const date = new Date(weekStartDate);
            date.setDate(date.getDate() + index);
            const isToday = date.toDateString() === new Date().toDateString();
            const isFuture = date > new Date();

            return (
              <div
                key={day}
                className={`
                  p-2 rounded-lg text-center transition-all
                  ${isToday 
                    ? 'bg-primary-100 dark:bg-primary-500/20 ring-2 ring-primary-500' 
                    : isFuture 
                      ? 'bg-slate-50 dark:bg-slate-800/30 opacity-50' 
                      : 'bg-slate-50 dark:bg-slate-800/30'
                  }
                `}
              >
                <p className={`text-xs ${isToday ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-slate-500 dark:text-slate-400'}`}>
                  {day}
                </p>
                <p className={`text-sm font-medium ${isToday ? 'text-primary-700 dark:text-primary-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {date.getDate()}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>

      {stats.total_duration === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-6"
        >
          <EmptyState
            icon={<CalendarClock className="w-12 h-12 text-gray-400" />}
            title={t('scheduler.weeklyReport.empty')}
            description={t('scheduler.weeklyReport.emptyHint')}
          />
        </motion.div>
      )}
    </div>
  );
};
