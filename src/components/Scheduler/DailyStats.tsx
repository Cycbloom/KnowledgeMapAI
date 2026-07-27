import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarClock,
  Clock,
  Target,
  CheckCircle,
  Timer,
  TrendingUp,
  Zap,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from '../../services/api';
import { EmptyState } from '../common/EmptyState';
import { ErrorState } from '../common/ErrorState';
import { formatDuration, formatDate } from '../../utils/formatters';
import type {DailyFocusStats} from '@shared/types';

interface DailyStatsProps {
  date?: string;
  className?: string;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string | number;
  subValue?: string;
  color: string;
  delay?: number;
}> = ({ icon, label, value, subValue, color, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.3 }}
    className={`relative overflow-hidden p-4 rounded-xl bg-white dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500/50 shadow-sm`}
  >
    <div
      className={`absolute top-0 right-0 w-20 h-20 -mr-6 -mt-6 rounded-full opacity-10 ${color}`}
    />
    <div className="flex items-center gap-3">
      <div className={`p-2 rounded-lg ${color} bg-opacity-20`}>{icon}</div>
      <div>
        <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white">
          {value}
        </p>
        {subValue && (
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {subValue}
          </p>
        )}
      </div>
    </div>
  </motion.div>
);

const formatDurationDetailed = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  if (minutes > 0) {
    return `${minutes}分钟${secs}秒`;
  }
  return `${secs}秒`;
};

export const DailyStats: React.FC<DailyStatsProps> = ({
  date,
  className = "",
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<DailyFocusStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const stats = await api.scheduler.getDailyFocusStats(date);
        setStats(stats);
        setError(null);
      } catch (err) {
        console.error("Failed to fetch daily stats:", err);
        setError(t('scheduler.reports.loadDailyFailed'));
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [date, retryCount, t]);

  if (loading) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-1/4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

  const displayDate = formatDate(stats.date, "long-date");

  const focusHours = stats.total_duration / 3600;
  const productivityScore = Math.min(
    100,
    Math.round(
      (focusHours / 4) * 40 +
        (stats.tasks_completed / 5) * 30 +
        (stats.pomodoro_count / 8) * 30,
    ),
  );

  return (
    <div className={`p-6 ${className}`}>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <TrendingUp size={20} className="text-primary-500" />
          每日统计
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          {displayDate}
        </p>
      </motion.div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={<Clock size={20} className="text-primary-500" />}
          label={t('scheduler.dailyStats.focusDurationLabel')}
          value={formatDuration(stats.total_duration, { format: 'compact', emptyText: '0m' })}
          subValue={formatDurationDetailed(stats.total_duration)}
          color="bg-primary-500"
          delay={0.1}
        />
        <StatCard
          icon={<Timer size={20} className="text-emerald-500" />}
          label={t('scheduler.dailyStats.pomodoroLabel')}
          value={stats.pomodoro_count}
          subValue="个番茄"
          color="bg-emerald-500"
          delay={0.2}
        />
        <StatCard
          icon={<Target size={20} className="text-violet-500" />}
          label={t('scheduler.dailyStats.focusCountLabel')}
          value={stats.session_count}
          subValue={`平均 ${formatDuration(stats.avg_session_duration, { format: 'compact', emptyText: '0m' })}`}
          color="bg-violet-500"
          delay={0.3}
        />
        <StatCard
          icon={<CheckCircle size={20} className="text-amber-500" />}
          label={t('scheduler.dailyStats.completedTasksLabel')}
          value={stats.tasks_completed}
          subValue="个任务"
          color="bg-amber-500"
          delay={0.4}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="relative p-4 rounded-xl bg-gradient-to-r from-primary-500/10 to-violet-500/10 border border-primary-200 dark:border-primary-800/50"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-gradient-to-br from-primary-500 to-violet-500">
              <Zap size={20} className="text-white" />
            </div>
            <div>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                生产力评分
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {productivityScore}
                <span className="text-sm font-normal text-slate-500">/100</span>
              </p>
            </div>
          </div>
          <div
            role="progressbar"
            aria-valuenow={Math.round(productivityScore)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={t('common.aria.progress')}
            className="w-32 h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
          >
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${productivityScore}%` }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="h-full bg-gradient-to-r from-primary-500 to-violet-500 rounded-full"
            />
          </div>
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
            title={t('scheduler.dailyStats.empty')}
            description={t('scheduler.dailyStats.emptyHint')}
          />
        </motion.div>
      )}
    </div>
  );
};
