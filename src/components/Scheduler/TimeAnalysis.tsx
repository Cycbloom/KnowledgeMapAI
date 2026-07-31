import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Sun, Moon, Coffee, Sunset, BarChart3 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../../services/api';
import { formatDuration } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';
import { Skeleton } from '../common';
import type {TaskExecution} from '@shared/types';

interface TimeAnalysisProps {
  className?: string;
}

interface HourData {
  hour: number;
  count: number;
  duration: number;
  label: string;
}

export const TimeAnalysis: React.FC<TimeAnalysisProps> = ({
  className = '',
}) => {
  const [executions, setExecutions] = useState<TaskExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const timePeriods = useMemo(() => [
    { name: t('scheduler.timeAnalysis.periodEarlyMorning'), hours: [0, 1, 2, 3, 4, 5], icon: Moon, color: '#6366f1' },
    { name: t('scheduler.timeAnalysis.periodMorning'), hours: [6, 7, 8, 9, 10, 11], icon: Sun, color: '#f59e0b' },
    { name: t('scheduler.timeAnalysis.periodAfternoon'), hours: [12, 13, 14, 15, 16, 17], icon: Coffee, color: '#06b6d4' },
    { name: t('scheduler.timeAnalysis.periodEvening'), hours: [18, 19, 20, 21, 22, 23], icon: Sunset, color: '#8b5cf6' },
  ], [t]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.scheduler.getExecutions({});
      setExecutions(data);
    } catch (error) {
      console.error('Failed to load time analysis:', error);
    } finally {
      setLoading(false);
    }
  };

  const getHourlyData = (): HourData[] => {
    const hourMap = new Map<number, { count: number; duration: number }>();

    for (let i = 0; i < 24; i++) {
      hourMap.set(i, { count: 0, duration: 0 });
    }

    executions.forEach(exec => {
      if (exec.started_at) {
        const hour = new Date(exec.started_at).getHours();
        const existing = hourMap.get(hour) || { count: 0, duration: 0 };
        hourMap.set(hour, {
          count: existing.count + 1,
          duration: existing.duration + (exec.duration || 0),
        });
      }
    });

    return Array.from(hourMap.entries()).map(([hour, data]) => ({
      hour,
      count: data.count,
      duration: data.duration,
      label: `${hour.toString().padStart(2, '0')}:00`,
    }));
  };

  const getPeriodStats = () => {
    const hourlyData = getHourlyData();

    return timePeriods.map(period => {
      const periodData = period.hours.map(h => hourlyData[h]);
      const totalDuration = periodData.reduce((sum, d) => sum + d.duration, 0);
      const totalCount = periodData.reduce((sum, d) => sum + d.count, 0);
      const peakHour = periodData.reduce((max, d) => d.duration > max.duration ? d : max, periodData[0]);

      return {
        name: period.name,
        icon: period.icon,
        color: period.color,
        totalDuration,
        totalCount,
        peakHour: peakHour.hour,
      };
    });
  };

  const hourlyData = getHourlyData();
  const periodStats = getPeriodStats();
  const maxDuration = Math.max(...hourlyData.map(d => d.duration), 1);

  const peakPeriod = periodStats.reduce((max, p) =>
    p.totalDuration > max.totalDuration ? p : max
  , periodStats[0]);

  return (
    <figure className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-500 p-6 ${className}`}>
      <figcaption className="sr-only">{t('scheduler.timeAnalysis.title')}</figcaption>
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
          <Clock size={20} className="text-amber-500" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{t('scheduler.timeAnalysis.title')}</h3>
          <p className="text-xs text-slate-500">{t('scheduler.timeAnalysis.subtitle')}</p>
        </div>
      </div>

      {loading ? (
        <Skeleton className="h-48 w-full" />
      ) : executions.length === 0 ? (
        <EmptyState icon={<BarChart3 size={32} />} title={t('scheduler.empty.timeAnalysis')} />
      ) : (
        <>
          <div className="mb-6">
            <div className="flex items-end gap-0.5 h-20 mb-2">
              {hourlyData.map((data, i) => {
                const height = (data.duration / maxDuration) * 100;
                const hour = i;
                let bgColor = 'bg-primary-500';
                if (hour >= 6 && hour < 12) bgColor = 'bg-amber-500';
                else if (hour >= 12 && hour < 18) bgColor = 'bg-primary-500';
                else if (hour >= 18 && hour < 24) bgColor = 'bg-primary-500';

                return (
                  <motion.div
                    key={i}
                    className="flex-1 group relative"
                    initial={{ height: 0 }}
                    animate={{ height: '100%' }}
                    transition={{ delay: i * 0.01 }}
                  >
                    <motion.div
                      className={`w-full rounded-t ${bgColor}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${Math.max(height, 2)}%` }}
                      transition={{ delay: i * 0.01, duration: 0.2 }}
                    />
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                      {data.label}: {formatDuration(data.duration, { format: 'compact', emptyText: '0m' })}
                    </div>
                  </motion.div>
                );
              })}
            </div>
            <div className="flex justify-between text-xs text-slate-400">
              <span>00:00</span>
              <span>06:00</span>
              <span>12:00</span>
              <span>18:00</span>
              <span>24:00</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 mb-4">
            {periodStats.map((period, index) => {
              const IconComponent = period.icon;
              const isPeak = period.name === peakPeriod.name;

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-3 rounded-xl text-center ${
                    isPeak 
                      ? 'bg-gradient-to-br from-amber-100 to-amber-50 dark:from-amber-500/20 dark:to-amber-500/10 border border-amber-200 dark:border-amber-500/30' 
                      : 'bg-slate-50 dark:bg-slate-800/50'
                  }`}
                >
                  <IconComponent 
                    size={20} 
                    className="mx-auto mb-1"
                    style={{ color: period.color }}
                  />
                  <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                    {period.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {formatDuration(period.totalDuration, { format: 'compact', emptyText: '0m' })}
                  </div>
                </motion.div>
              );
            })}
          </div>

          <div className="p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10 rounded-xl border border-amber-100 dark:border-amber-500/20">
            <div className="flex items-center gap-2">
              <peakPeriod.icon size={16} style={{ color: peakPeriod.color }} />
              <span className="text-sm text-slate-600 dark:text-slate-300">
                {t('scheduler.timeAnalysis.peakPeriodMessage', { period: peakPeriod.name })}
              </span>
            </div>
          </div>
        </>
      )}
    </figure>
  );
};
