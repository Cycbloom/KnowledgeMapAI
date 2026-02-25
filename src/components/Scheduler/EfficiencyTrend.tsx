import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Calendar } from 'lucide-react';
import { schedulerApi, TaskStats } from '../../services/api/scheduler';

interface EfficiencyTrendProps {
  period?: '7d' | '30d' | '90d';
  className?: string;
}

export const EfficiencyTrend: React.FC<EfficiencyTrendProps> = ({
  period = '7d',
  className = '',
}) => {
  const [stats, setStats] = useState<TaskStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [period]);

  const loadData = async () => {
    setLoading(true);
    try {
      const periodMap = {
        '7d': 'week' as const,
        '30d': 'month' as const,
        '90d': 'month' as const,
      };
      const data = await schedulerApi.getStats(periodMap[period]);
      setStats(data);
    } catch (error) {
      console.error('Failed to load efficiency trend:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getChartData = () => {
    if (!stats?.daily) return [];
    return stats.daily.map((day: { duration: number; completed: number; date: string }, index: number) => ({
      day: index,
      duration: day.duration,
      completed: day.completed,
      date: day.date,
    }));
  };

  const chartData = getChartData();
  const maxDuration = Math.max(...chartData.map((d: { duration: number }) => d.duration), 1);
  const avgDuration = chartData.reduce((sum: number, d: { duration: number }) => sum + d.duration, 0) / chartData.length;

  return (
    <div className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-cyan-100 dark:bg-cyan-500/20 rounded-xl">
            <TrendingUp size={20} className="text-cyan-500" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white">效率趋势</h3>
            <p className="text-xs text-slate-500">专注时长变化</p>
          </div>
        </div>
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              onClick={() => {}}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                period === p
                  ? 'bg-white dark:bg-slate-700 text-cyan-500 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {p === '7d' ? '7天' : p === '30d' ? '30天' : '90天'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-40 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-cyan-500" />
        </div>
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
                  animate={{ height: '100%' }}
                  transition={{ delay: i * 0.03 }}
                >
                  <motion.div
                    className="w-full rounded-t bg-gradient-to-t from-cyan-500 to-blue-500"
                    initial={{ height: 0 }}
                    animate={{ height: `${Math.max(height, 2)}%` }}
                    transition={{ delay: i * 0.03, duration: 0.3 }}
                    title={`${formatDuration(data.duration)}`}
                  />
                </motion.div>
              );
            })}
          </div>

          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-500">
              平均: <span className="font-medium text-cyan-500">{formatDuration(avgDuration)}</span>
            </div>
            <div className="text-slate-500">
              总计: <span className="font-medium text-emerald-500">{formatDuration(stats?.total_duration || 0)}</span>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-3 h-3 rounded bg-gradient-to-r from-cyan-500 to-blue-500" />
                <span>专注时长</span>
              </div>
              <div className="flex items-center gap-1">
                <Calendar size={12} />
                <span>{chartData.length} 天</span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
