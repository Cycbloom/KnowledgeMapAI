import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Calendar } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { formatDuration } from '../../utils/formatters';
import type {UserTaskStats} from '@shared/types';
import { Skeleton } from '../common';

interface EfficiencyTrendProps {
  period?: "7d" | "30d" | "90d";
  className?: string;
}

export const EfficiencyTrend: React.FC<EfficiencyTrendProps> = ({
  period = "7d",
  className = "",
}) => {
  const { t } = useTranslation();
  const [stats, setStats] = useState<UserTaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const periodMap = {
        "7d": "week" as const,
        "30d": "month" as const,
        "90d": "month" as const,
      };
      const data = await api.scheduler.getStats(periodMap[period]);
      setStats(data);
    } catch (error) {
      console.error("Failed to load efficiency trend:", error);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    if (!stats?.daily) return [];
    return stats.daily.map(
      (
        day: { duration: number; completed: number; date: string },
        index: number,
      ) => ({
        day: index,
        duration: day.duration,
        completed: day.completed,
        date: day.date,
      }),
    );
  };

  const chartData = getChartData();
  const maxDuration = Math.max(
    ...chartData.map((d: { duration: number }) => d.duration),
    1,
  );
  const avgDuration =
    chartData.reduce(
      (sum: number, d: { duration: number }) => sum + d.duration,
      0,
    ) / chartData.length;

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-500 p-6 ${className}`}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-100 dark:bg-primary-500/20 rounded-xl">
            <TrendingUp size={20} className="text-primary-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">
              {t('scheduler.efficiencyTrend.title')}
            </h3>
            <p className="text-xs text-slate-500">{t('scheduler.efficiencyTrend.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(["7d", "30d", "90d"] as const).map((p) => (
            <button
              key={p}
              onClick={() => {}}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? "bg-white dark:bg-slate-700 text-primary-500 shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {p === "7d" ? t('scheduler.efficiencyTrend.period7d') : p === "30d" ? t('scheduler.efficiencyTrend.period30d') : t('scheduler.efficiencyTrend.period90d')}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : (
        <>
          <div className="h-40 flex items-end gap-1 mb-4">
            {chartData.map((data, i) => {
              const height = (data.duration / maxDuration) * 100;
              return (
                <motion.div
                  key={i}
                  className="flex-1 flex flex-col items-center justify-end"
                  initial={{ height: 0 }}
                  animate={{ height: "100%" }}
                  transition={{ delay: i * 0.03 }}
                >
                  <motion.div
                    className="w-full rounded-t bg-gradient-to-t from-primary-500 to-primary-500"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 2)}%` }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    title={`${formatDuration(data.duration, { format: 'compact', emptyText: '0m' })}`}
                  />
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-500">
              {t('scheduler.efficiencyTrend.average')}{" "}
              <span className="font-medium text-primary-500">
                {formatDuration(avgDuration, { format: 'compact', emptyText: '0m' })}
              </span>
            </div>
            <div className="text-slate-500">
              {t('scheduler.efficiencyTrend.total')}{" "}
              <span className="font-medium text-emerald-500">
                {formatDuration(stats?.total_duration || 0, { format: 'compact', emptyText: '0m' })}
              </span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gradient-to-r from-primary-500 to-primary-500" />
                <span>{t('scheduler.efficiencyTrend.focusDuration')}</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                <span>{t('scheduler.efficiencyTrend.dayCount', { count: chartData.length })}</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
