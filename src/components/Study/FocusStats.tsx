import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../services/api';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Clock, CheckCircle2, Zap } from 'lucide-react';

interface DailyFocusStat {
  date: string;
  minutes: number;
}

interface FocusStatsData {
  today: {
    minutes: number;
    sessions: number;
  };
  total: {
    minutes: number;
    sessions: number;
  };
  daily: DailyFocusStat[];
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue: string;
}

export const FocusStats = () => {
  const { t } = useTranslation();
  const { data: stats, isLoading } = useQuery({
    queryKey: ['focus-stats'],
    queryFn: async () => {
      const res = await api.focus.getStats();
      return res.data as FocusStatsData;
    }
  });

  if (isLoading || !stats) return <div className="animate-pulse h-64 bg-gray-100 dark:bg-slate-800 rounded-xl" />;

  const chartData = stats.daily.map((d: DailyFocusStat) => ({
    date: d.date,
    name: d.date.slice(5),
    minutes: d.minutes
  }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={<Clock className="text-primary-500" />} 
          label={t('study.focusStats.todayFocus')} 
          value={t('study.focusStats.minutes', { count: stats.today.minutes })}
          subValue={t('study.focusStats.sessions', { count: stats.today.sessions })}
        />
        <StatCard 
          icon={<Zap className="text-amber-500" />} 
          label={t('study.focusStats.totalFocus')} 
          value={t('study.focusStats.hours', { count: (stats.total.minutes / 60).toFixed(1) })}
          subValue={t('study.focusStats.sessions', { count: stats.total.sessions })}
        />
        <StatCard 
          icon={<CheckCircle2 className="text-emerald-500" />} 
          label={t('study.focusStats.avgDuration')} 
          value={t('study.focusStats.minutes', { count: stats.total.sessions ? Math.round(stats.total.minutes / stats.total.sessions) : 0 })}
          subValue={t('study.focusStats.perSession')}
        />
      </div>

      <div className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-gray-200 dark:border-slate-700">
        <h3 className="text-lg font-semibold mb-6 text-gray-800 dark:text-gray-200">{t('study.focusStats.weeklyTrend')}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fill: '#94a3b8', fontSize: 12 }} 
                dy={10}
              />
              <YAxis 
                hide 
              />
              <Tooltip 
                cursor={{ fill: 'transparent' }}
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-gray-900 text-white text-xs py-1 px-2 rounded">
                        {t('study.focusStats.minutes', { count: payload[0].value })}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.minutes > 0 ? '#3b82f6' : '#e2e8f0'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value, subValue }: StatCardProps) => (
  <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 flex items-center gap-4">
    <div className="p-3 bg-gray-50 dark:bg-slate-700/50 rounded-lg">
      {icon}
    </div>
    <div>
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-xl font-bold text-gray-900 dark:text-white">{value}</h4>
        <span className="text-xs text-gray-400">{subValue}</span>
      </div>
    </div>
  </div>
);
