import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useStatistics, useUser, useGraphs } from '../hooks/queries';
import { useTheme } from '../hooks';
import { ActivityHeatmap } from '../components/Statistics/ActivityHeatmap';
import {
  KnowledgeHeatmap,
  MasteryDistributionChart,
  QuickStatsCards,
  type CardTypeName
} from '../components/Statistics/LearningStatsEnhanced';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, ReferenceLine
} from 'recharts';
import { AlertCircle, BookOpen, Brain, Clock, TrendingUp, LucideIcon } from 'lucide-react';
import type { Graph } from '../types';
import { formatNumber } from '../utils/formatters';
import { Skeleton } from '../components/common';
import { themeClasses } from '@/utils/themeClasses';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  color: string;
  isDark: boolean;
}

const MetricCard = ({ title, value, subtext, icon: Icon, color, isDark }: MetricCardProps) => (
  <div className={`p-6 rounded-lg shadow-sm border flex items-start justify-between ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
    <div>
      <p className={`text-sm font-medium mb-1 ${themeClasses.textSecondary(isDark)}`}>{title}</p>
      <h3 className={`text-3xl font-bold ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{typeof value === 'number' ? formatNumber(value) : value}</h3>
      {subtext && <p className={`text-xs mt-2 ${themeClasses.textMuted(isDark)}`}>{subtext}</p>}
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

interface ForecastDataItem {
  date: string;
  count: number;
}

const ForecastChart = ({ data, t, isDark }: { data: ForecastDataItem[], t: TFunction, isDark: boolean }) => (
  <div className={`p-6 rounded-lg shadow-sm border h-80 flex flex-col ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
    <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{t('statistics.forecast.title')}</h3>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
          <XAxis
            dataKey="date"
            tickFormatter={(value) => `${new Date(value).getDate().toString()}${t('statistics.day')}`}
            axisLine={false}
            tickLine={false}
            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
          />
          <RechartsTooltip
            cursor={{ fill: isDark ? '#1e293b' : '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff' }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} name={t('statistics.forecast.reviewCards')} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

interface GrowthDataItem {
  date: string;
  count: number;
}

const GrowthChart = ({ data, t, isDark }: { data: GrowthDataItem[], t: TFunction, isDark: boolean }) => (
  <div className={`p-6 rounded-lg shadow-sm border h-80 flex flex-col ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
    <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{t('statistics.growth.title')}</h3>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
          <XAxis
            dataKey="date"
            tickFormatter={(value, index) => index % 5 === 0 ? `${new Date(value).getMonth() + 1}/${new Date(value).getDate()}` : ''}
            axisLine={false}
            tickLine={false}
            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
            dy={10}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
          />
          <RechartsTooltip
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff' }}
          />
          <Area
            type="monotone"
            dataKey="count"
            stroke="#10b981"
            strokeWidth={3}
            fillOpacity={1}
            fill="url(#colorGrowth)"
            name={t('statistics.growth.newCards')}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const ForgettingCurveChart = ({ retentionThreshold, avgStability, t, isDark }: { retentionThreshold: number, avgStability: number, t: TFunction, isDark: boolean }) => {
  const data = useMemo(() => {
    const points = [];
    const stability = avgStability > 0 ? avgStability : 7;
    for (let i = 0; i <= 30; i += 0.5) {
      const r = Math.exp(-i / stability);
      points.push({
        day: i,
        retention: Math.round(r * 100),
      });
    }
    return points;
  }, [avgStability]);

  return (
    <div className={`p-6 rounded-lg shadow-sm border h-80 flex flex-col ${isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'}`}>
      <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-slate-200' : 'text-gray-800'}`}>{t('statistics.forgettingCurve.title')}</h3>
      <p className={`text-xs mb-6 ${themeClasses.textSecondary(isDark)}`}>
        {t('statistics.forgettingCurve.description', { stability: avgStability > 0 ? avgStability.toFixed(1) : 7 })}
      </p>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#1e293b' : '#f1f5f9'} />
            <XAxis
              dataKey="day"
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
            />
            <YAxis
              domain={[0, 100]}
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 12 }}
              tickFormatter={(val) => `${val}%`}
            />
            <RechartsTooltip
              formatter={(value) => [`${value}%`, t('statistics.forgettingCurve.retentionRate')]}
              labelFormatter={(label) => t('statistics.forgettingCurve.dayLabel', { day: label })}
              contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', backgroundColor: isDark ? '#1e293b' : '#fff' }}
            />
            <ReferenceLine
              y={retentionThreshold * 100}
              stroke="#ef4444"
              strokeDasharray="3 3"
              label={{ value: t('statistics.forgettingCurve.target', { percent: retentionThreshold * 100 }), position: 'right', fill: '#ef4444', fontSize: 10 }}
            />
            <Line
              type="monotone"
              dataKey="retention"
              stroke="#6366f1"
              strokeWidth={3}
              dot={false}
              name={t('statistics.forgettingCurve.retentionRate')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const Statistics = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { data: stats, isLoading, error, refetch } = useStatistics() as unknown as {
    data?: {
      distribution: Array<{ name: CardTypeName; value: number; color: string }>;
      metrics: { learning: number; dueToday: number; totalCards: number; avgStability: number };
      heatmap: { date: string; count: number }[];
      forecast: { date: string; count: number }[];
      growth: { date: string; count: number }[];
    } | null;
    isLoading: boolean;
    error: Error | null;
    refetch: () => Promise<unknown>;
  };
  const { data: userData } = useUser();
  const { data: graphsData } = useGraphs();
  const [activeTab, setActiveTab] = useState<'overview' | 'graphs'>('overview');
  const retention = userData?.user?.profile?.settings?.request_retention || 0.9;

  const totalNodesCount = useMemo(() => {
    if (!graphsData) return 0;
    return graphsData.reduce((sum: number, g: Graph) => sum + (g.nodes_count || 0), 0);
  }, [graphsData]);

  const graphHeatmapData = useMemo(() => {
    if (!graphsData) return [];
    return graphsData.map((graph: Graph) => ({
      id: graph.id,
      title: graph.title,
      nodes: [],
      nodes_count: graph.nodes_count || 0
    }));
  }, [graphsData]);

  const distributionData = useMemo(() => {
    if (!stats?.distribution) return [];
    return stats.distribution.map((item: { name: CardTypeName; value: number; color: string }) => ({
      name: item.name,
      value: item.value,
      color: item.color
    }));
  }, [stats]);

  if (isLoading) {
    return (
      <div className="h-full overflow-y-auto p-8 bg-slate-50 dark:bg-slate-900">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 space-y-3"
            >
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-3 w-24" />
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (error) {return (
    <div className="p-8 flex flex-col items-center justify-center text-center">
      <AlertCircle size={48} className="text-red-500 mb-4" />
      <p className="text-red-600 dark:text-red-400 mb-4">{t('statistics.loadError')}</p>
      <button
        type="button"
        onClick={() => { void refetch(); }}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        {t('common.retry')}
      </button>
    </div>
  );}
  if (!stats) {
    return (
      <div className="h-full flex items-center justify-center p-8 bg-slate-50 dark:bg-slate-900">
        <p className="text-gray-500 dark:text-gray-400">{t('common.loading')}</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-50 dark:bg-slate-900">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white">{t('statistics.title')}</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2">{t('statistics.subtitle')}</p>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'overview'
              ? 'bg-primary-500 text-white'
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          {t('statistics.tabs.overview')}
        </button>
        <button
          onClick={() => setActiveTab('graphs')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'graphs'
              ? 'bg-primary-500 text-white'
              : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          {t('statistics.tabs.graphs')}
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              title={t('statistics.metrics.totalCards')}
              value={stats.metrics.totalCards}
              subtext={t('statistics.metrics.totalCardsSubtext')}
              icon={BookOpen}
              color="bg-primary-500"
              isDark={isDark}
            />
            <MetricCard
              title={t('statistics.metrics.dueToday')}
              value={stats.metrics.dueToday}
              subtext={t('statistics.metrics.dueTodaySubtext')}
              icon={Clock}
              color="bg-amber-500"
              isDark={isDark}
            />
            <MetricCard
              title={t('statistics.metrics.learning')}
              value={stats.metrics.learning}
              subtext={t('statistics.metrics.learningSubtext')}
              icon={Brain}
              color="bg-green-500"
              isDark={isDark}
            />
            <MetricCard
              title={t('statistics.metrics.avgStability')}
              value={stats.metrics.avgStability}
              subtext={t('statistics.metrics.avgStabilitySubtext')}
              icon={TrendingUp}
              color="bg-primary-500"
              isDark={isDark}
            />
          </div>

          <div className="mb-8">
            <ActivityHeatmap data={stats.heatmap || []} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <ForecastChart data={stats.forecast || []} t={t} isDark={isDark} />
            <ForgettingCurveChart
              retentionThreshold={retention}
              avgStability={stats.metrics.avgStability}
              t={t}
              isDark={isDark}
            />
          </div>

          <div className="mb-8">
            <GrowthChart data={stats.growth || []} t={t} isDark={isDark} />
          </div>
        </>
      ) : (
        <>
          <div className="mb-8">
            <QuickStatsCards 
              totalNodes={totalNodesCount}
              masteredNodes={stats.metrics.learning}
              dueToday={stats.metrics.dueToday}
              streak={userData?.user?.profile?.study_streak || 0}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <KnowledgeHeatmap graphData={graphHeatmapData} />
            <MasteryDistributionChart distribution={distributionData} />
          </div>
        </>
      )}
    </div>
  );
};

export default Statistics;
