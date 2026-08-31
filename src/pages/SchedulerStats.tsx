import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSchedulerStats, useHeatmap, useExecutions } from '../hooks';
import type { ExecutionFilters, TaskExecution } from '@shared/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  CheckCircle2, Clock, ListTodo, TrendingUp, Zap, Activity,
  Calendar, ChevronLeft, ChevronRight, Filter, RefreshCw, XCircle, Timer
} from 'lucide-react';
import { QUEUE_COLORS, type QueueLevel } from '@/constants/scheduler';
import { formatDate } from '../utils/formatters';
import { Skeleton } from '../components/common';

const TechCard = ({ children, className = '', glow = false }: { children: React.ReactNode; className?: string; glow?: boolean }) => (
  <div className={`
    bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50
    ${glow ? 'shadow-[0_0_30px_rgba(6,182,212,0.1)]' : 'shadow-lg'}
    ${className}
  `}>
    {children}
  </div>
);

const GlowingMetricCard = ({ 
  title, 
  value, 
  subtext, 
  icon: Icon, 
  colorKey = 0 as QueueLevel,
  trend
}: { 
  title: string; 
  value: string | number; 
  subtext?: string; 
  icon: React.ElementType; 
  colorKey?: QueueLevel;
  trend?: number;
}) => {
  const colors = QUEUE_COLORS[colorKey];
  
  return (
    <TechCard className="p-6 relative overflow-hidden group" glow>
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at top right, ${colors.hexGlow}, transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg ${colors.accent} shadow-lg`} style={{ boxShadow: `0 0 20px ${colors.hexGlow}` }}>
            <Icon size={24} className="text-white" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendingUp size={14} className={trend < 0 ? 'rotate-180' : ''} />
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <h3 className="text-3xl font-bold text-white mb-1" style={{ textShadow: `0 0 20px ${colors.hexGlow}` }}>
          {value}
        </h3>
        <p className="text-slate-400 text-sm">{title}</p>
        {subtext && <p className="text-slate-500 text-xs mt-1">{subtext}</p>}
      </div>
    </TechCard>
  );
};

const QueueDistributionChart = ({ data }: { data: { q0: number; q1: number; q2: number } }) => {
  const { t } = useTranslation();
  const chartData = [
    { name: t('schedulerStats.queueDistribution.q0'), value: data.q0, color: QUEUE_COLORS[0].hex },
    { name: t('schedulerStats.queueDistribution.q1'), value: data.q1, color: QUEUE_COLORS[1].hex },
    { name: t('schedulerStats.queueDistribution.q2'), value: data.q2, color: QUEUE_COLORS[2].hex },
  ];

  return (
    <TechCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <Zap size={20} className="text-primary-400" />
        {t('schedulerStats.queueDistribution.title')}
      </h3>
      <div className="flex items-center justify-center">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={5}
              dataKey="value"
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
              ))}
            </Pie>
            <RechartsTooltip
              contentStyle={{ 
                backgroundColor: 'rgba(30, 41, 59, 0.95)', 
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '8px',
                color: '#fff'
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-4">
        {chartData.map((item) => (
          <div key={item.name} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="text-slate-400 text-sm">{item.name}: {item.value}</span>
          </div>
        ))}
      </div>
    </TechCard>
  );
};

const DailyTrendChart = ({ data }: { data: { date: string; completed: number; duration: number }[] }) => {
  const { t } = useTranslation();
  return (
    <TechCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <Activity size={20} className="text-emerald-400" />
        {t('schedulerStats.dailyTrend.title')}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => t('schedulerStats.dailyTrend.dayLabel', { day: new Date(value).getDate() })}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '8px',
                color: '#fff'
              }}
              labelFormatter={(label) => formatDate(label as string, 'short-date')}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#10b981"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorCompleted)"
              name={t('schedulerStats.dailyTrend.completed')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </TechCard>
  );
};

const DurationTrendChart = ({ data }: { data: { date: string; completed: number; duration: number }[] }) => {
  const { t } = useTranslation();
  // 保留本地实现：依赖 i18n 翻译键，无法直接使用 @/utils/formatters
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('schedulerStats.durations.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return t('schedulerStats.durations.hoursAndMinutes', { hours, minutes: remainingMinutes });
  };

  return (
    <TechCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <Clock size={20} className="text-violet-400" />
        {t('schedulerStats.durationTrend.title')}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => t('schedulerStats.dailyTrend.dayLabel', { day: new Date(value).getDate() })}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => `${Math.floor(value / 60)}m`}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => value !== undefined ? [formatDuration(value as number), t('schedulerStats.durationTrend.duration')] : ['', t('schedulerStats.durationTrend.duration')]}
              labelFormatter={(label) => formatDate(label as string, 'short-date')}
            />
            <Line
              type="monotone"
              dataKey="duration"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#8b5cf6' }}
              name={t('schedulerStats.durationTrend.duration')}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </TechCard>
  );
};

const SchedulerHeatmap = ({ data, year, month, onYearChange, onMonthChange }: { 
  data: { date: string; count: number; duration: number }[];
  year: number;
  month?: number;
  onYearChange: (year: number) => void;
  onMonthChange: (month?: number) => void;
}) => {
  const { t } = useTranslation();
  const currentYear = year;
  const currentMonth = month;

  const days = useMemo(() => {
    const result = [];
    let startDate: Date;
    let endDate: Date;

    if (currentMonth !== undefined) {
      startDate = new Date(currentYear, currentMonth - 1, 1);
      endDate = new Date(currentYear, currentMonth, 0);
    } else {
      startDate = new Date(currentYear, 0, 1);
      endDate = new Date(currentYear, 11, 31);
    }

    const d = new Date(startDate);
    while (d <= endDate) {
      result.push(d.toISOString().split('T')[0]);
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [currentYear, currentMonth]);

  // 预构建 date 索引，避免每次渲染重建 Map 并在 days 渲染循环中线性扫描（原每次渲染 O(data) 重建）
  const activityMap = useMemo(() => new Map(data.map(d => [d.date, d])), [data]);

  const getColor = (count: number) => {
    if (count === 0) return 'bg-slate-700/50';
    if (count <= 2) return 'bg-primary-900';
    if (count <= 5) return 'bg-primary-700';
    if (count <= 10) return 'bg-primary-500';
    return 'bg-primary-400';
  };

  const getGlow = (count: number) => {
    if (count === 0) return '';
    if (count <= 2) return 'shadow-[0_0_5px_rgba(6,182,212,0.3)]';
    if (count <= 5) return 'shadow-[0_0_8px_rgba(6,182,212,0.5)]';
    if (count <= 10) return 'shadow-[0_0_12px_rgba(6,182,212,0.7)]';
    return 'shadow-[0_0_15px_rgba(6,182,212,0.9)]';
  };

  // 保留本地实现：依赖 i18n 翻译键，无法直接使用 @/utils/formatters
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return t('schedulerStats.durations.minutes', { count: minutes });
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return t('schedulerStats.durations.compactHoursMinutes', { hours, minutes: remainingMinutes });
  };

  const months = [
    t('schedulerStats.heatmap.months.jan'),
    t('schedulerStats.heatmap.months.feb'),
    t('schedulerStats.heatmap.months.mar'),
    t('schedulerStats.heatmap.months.apr'),
    t('schedulerStats.heatmap.months.may'),
    t('schedulerStats.heatmap.months.jun'),
    t('schedulerStats.heatmap.months.jul'),
    t('schedulerStats.heatmap.months.aug'),
    t('schedulerStats.heatmap.months.sep'),
    t('schedulerStats.heatmap.months.oct'),
    t('schedulerStats.heatmap.months.nov'),
    t('schedulerStats.heatmap.months.dec'),
  ];

  return (
    <TechCard className="p-6" glow>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar size={20} className="text-primary-400" />
          {t('schedulerStats.heatmap.title')}
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onYearChange(currentYear - 1)}
              className="p-1 rounded hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronLeft size={18} className="text-slate-400" />
            </button>
            <span className="text-white font-medium min-w-[60px] text-center">{currentYear}</span>
            <button
              onClick={() => onYearChange(currentYear + 1)}
              className="p-1 rounded hover:bg-slate-700 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </div>
          <select
            value={currentMonth ?? ''}
            onChange={(e) => onMonthChange(e.target.value ? parseInt(e.target.value) : undefined)}
            className="bg-slate-700 text-white rounded-lg px-3 py-1 border border-slate-600 focus:outline-none focus:border-primary-500"
          >
            <option value="">{t('schedulerStats.heatmap.fullYear')}</option>
            {months.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
        </div>
      </div>
      
      <div className="flex flex-wrap gap-1 mb-4">
        {days.map(date => {
          const dayData = activityMap.get(date);
          const count = dayData?.count || 0;
          const duration = dayData?.duration || 0;
          return (
            <div
              key={date}
              className={`w-3 h-3 rounded-sm ${getColor(count)} ${getGlow(count)} transition-all duration-200 hover:scale-125 cursor-pointer`}
              title={t('schedulerStats.heatmap.tooltip', { date, count, duration: formatDuration(duration) })}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>{t('schedulerStats.heatmap.activityLevel')}</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-slate-700/50 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-900 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-700 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-500 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-400 rounded-sm"></div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          {t('schedulerStats.heatmap.totalExecutions', { count: data.reduce<number>((sum, d) => sum + d.count, 0) })}
        </div>
      </div>
    </TechCard>
  );
};

const ExecutionHistoryTable = ({ filters, onFiltersChange }: { 
  filters: ExecutionFilters;
  onFiltersChange: (filters: ExecutionFilters) => void;
}) => {
  const { t } = useTranslation();
  const { data, isLoading, refetch } = useExecutions(filters);

  // 保留本地实现：依赖 i18n 翻译键，输出分秒格式
  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return t('schedulerStats.durations.minutesSeconds', { minutes, seconds: remainingSeconds });
  };

  const formatDateTime = (dateStr: string) => {
    return formatDate(dateStr, 'short-datetime');
  };

  // 状态标签映射：根据执行状态返回对应的 i18n 文本
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'completed':
        return t('schedulerStats.status.completed');
      case 'interrupted':
        return t('schedulerStats.status.interrupted');
      case 'time_slice_ended':
        return t('schedulerStats.status.timeSliceEnded');
      default:
        return status;
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { color: string; icon: React.ElementType }> = {
      completed: { color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: CheckCircle2 },
      interrupted: { color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: XCircle },
      time_slice_ended: { color: 'bg-primary-500/20 text-primary-400 border-primary-500/30', icon: Timer },
    };
    const cfg = styles[status] ?? { color: 'bg-slate-500/20 text-slate-400 border-slate-500/30', icon: Activity };
    const Icon = cfg.icon;
    const label = getStatusLabel(status);
    return (
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border ${cfg.color}`}
        aria-label={label}
      >
        <Icon size={12} />
        <span>{label}</span>
      </span>
    );
  };

  const getQueueBadge = (level: number) => {
    const colors = ['text-primary-400', 'text-violet-400', 'text-amber-400'];
    const colorClass = colors[level] ?? colors[0];
    return (
      <span
        className={`inline-flex items-center gap-1 font-mono ${colorClass}`}
        aria-label={t('schedulerStats.queueLevel.ariaLabel', { level })}
      >
        Q{level}
      </span>
    );
  };

  return (
    <TechCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ListTodo size={20} className="text-primary-400" />
          {t('schedulerStats.history.title')}
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filters.status || ''}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || undefined })}
              className="bg-slate-700 text-white rounded-lg px-3 py-1 border border-slate-600 focus:outline-none focus:border-primary-500 text-sm"
            >
              <option value="">{t('schedulerStats.history.allStatus')}</option>
              <option value="completed">{t('schedulerStats.status.completed')}</option>
              <option value="interrupted">{t('schedulerStats.status.interrupted')}</option>
              <option value="time_slice_ended">{t('schedulerStats.status.timeSliceEnded')}</option>
            </select>
          </div>
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <RefreshCw size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table
          className="w-full"
          aria-label={t('schedulerStats.history.tableAriaLabel', { defaultValue: '任务执行历史记录表' })}
        >
          <thead>
            <tr className="border-b border-slate-700">
              <th scope="col" className="text-left py-3 px-4 text-slate-400 font-medium text-sm">{t('schedulerStats.history.columns.taskId')}</th>
              <th scope="col" className="text-left py-3 px-4 text-slate-400 font-medium text-sm">{t('schedulerStats.history.columns.startedAt')}</th>
              <th scope="col" className="text-left py-3 px-4 text-slate-400 font-medium text-sm">{t('schedulerStats.history.columns.endedAt')}</th>
              <th scope="col" className="text-left py-3 px-4 text-slate-400 font-medium text-sm">{t('schedulerStats.history.columns.duration')}</th>
              <th scope="col" className="text-left py-3 px-4 text-slate-400 font-medium text-sm">{t('schedulerStats.history.columns.queue')}</th>
              <th scope="col" className="text-left py-3 px-4 text-slate-400 font-medium text-sm">{t('schedulerStats.history.columns.status')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  {t('schedulerStats.history.loading')}
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  {t('schedulerStats.history.empty')}
                </td>
              </tr>
            ) : (
              data.map((execution: TaskExecution) => (
                <tr key={execution.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="py-3 px-4 text-slate-300 font-mono text-sm">
                    {execution.task_id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-sm">
                    {execution.started_at ? formatDateTime(execution.started_at) : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-sm">
                    {execution.ended_at ? formatDateTime(execution.ended_at) : '-'}
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-sm">
                    {formatDuration(execution.duration)}
                  </td>
                  <td className="py-3 px-4">
                    {getQueueBadge(execution.queue_level)}
                  </td>
                  <td className="py-3 px-4">
                    {getStatusBadge(execution.status)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </TechCard>
  );
};

const EfficiencyChart = ({ data }: { data: { date: string; completed: number; duration: number }[] }) => {
  const { t } = useTranslation();
  const efficiencyData = useMemo(() => {
    return data.map(d => ({
      date: d.date,
      efficiency: d.completed > 0 ? Math.round(d.duration / d.completed / 60) : 0,
    }));
  }, [data]);

  return (
    <TechCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <TrendingUp size={20} className="text-amber-400" />
        {t('schedulerStats.efficiency.title')}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={efficiencyData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => t('schedulerStats.dailyTrend.dayLabel', { day: new Date(value).getDate() })}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748b', fontSize: 12 }}
              tickFormatter={(value) => `${value}m`}
            />
            <RechartsTooltip
              contentStyle={{
                backgroundColor: 'rgba(30, 41, 59, 0.95)',
                border: '1px solid rgba(100, 116, 139, 0.3)',
                borderRadius: '8px',
                color: '#fff'
              }}
              formatter={(value) => value !== undefined ? [t('schedulerStats.efficiency.value', { value }), t('schedulerStats.efficiency.label')] : ['', t('schedulerStats.efficiency.label')]}
              labelFormatter={(label) => formatDate(label as string, 'short-date')}
            />
            <Bar
              dataKey="efficiency"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              barSize={20}
              name={t('schedulerStats.efficiency.name')}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TechCard>
  );
};

export const SchedulerStats = () => {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState<number | undefined>(undefined);
  const [executionFilters, setExecutionFilters] = useState<ExecutionFilters>({});

  const { data: stats, isLoading: statsLoading, error: statsError } = useSchedulerStats(period);
  const { data: heatmapData } = useHeatmap(heatmapYear, heatmapMonth);

  // 保留本地实现：依赖 i18n 翻译键，无法直接使用 @/utils/formatters
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return t('schedulerStats.durations.hoursAndMinutes', { hours, minutes });
    }
    return t('schedulerStats.durations.minutes', { count: minutes });
  };

  if (statsLoading) {
    return (
      <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
        <div className="mb-8">
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="bg-slate-800/80 backdrop-blur-sm rounded-xl border border-slate-700/50 p-6 space-y-3"
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

  if (statsError) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center text-red-400">
          <p>{t('schedulerStats.loadFailed')}</p>
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const completionRate = stats.total_tasks > 0
    ? Math.round((stats.completed_tasks / stats.total_tasks) * 100)
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2" style={{ textShadow: '0 0 30px rgba(6, 182, 212, 0.3)' }}>
          {t('schedulerStats.title')}
        </h1>
        <p className="text-slate-400">{t('schedulerStats.subtitle')}</p>
      </div>

      <div className="flex gap-2 mb-6">
        {(['day', 'week', 'month', 'year'] as const).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
              period === p
                ? 'bg-primary-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.5)]'
                : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          >
            {t(`schedulerStats.periods.${p}`)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlowingMetricCard
          title={t('schedulerStats.metrics.totalTasks')}
          value={stats.total_tasks}
          subtext={t('schedulerStats.metrics.totalTasksSubtext')}
          icon={ListTodo}
          colorKey={0}
        />
        <GlowingMetricCard
          title={t('schedulerStats.metrics.completedTasks')}
          value={stats.completed_tasks}
          subtext={t('schedulerStats.metrics.completionRate', { rate: completionRate })}
          icon={CheckCircle2}
          colorKey={1}
        />
        <GlowingMetricCard
          title={t('schedulerStats.metrics.totalDuration')}
          value={formatDuration(stats.total_duration)}
          subtext={t('schedulerStats.metrics.totalDurationSubtext')}
          icon={Clock}
          colorKey={2}
        />
        <GlowingMetricCard
          title={t('schedulerStats.metrics.avgDuration')}
          value={stats.completed_tasks > 0 ? formatDuration(Math.round(stats.total_duration / stats.completed_tasks)) : '-'}
          subtext={t('schedulerStats.metrics.avgDurationSubtext')}
          icon={TrendingUp}
          colorKey={0}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <QueueDistributionChart data={stats.tasks_by_queue} />
        <div className="lg:col-span-2">
          <DailyTrendChart data={stats.daily || []} />
        </div>
      </div>

      <div className="mb-8">
        <SchedulerHeatmap 
          data={heatmapData || []}
          year={heatmapYear}
          month={heatmapMonth}
          onYearChange={setHeatmapYear}
          onMonthChange={setHeatmapMonth}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DurationTrendChart data={stats.daily || []} />
        <EfficiencyChart data={stats.daily || []} />
      </div>

      <div className="mb-8">
        <ExecutionHistoryTable 
          filters={executionFilters}
          onFiltersChange={setExecutionFilters}
        />
      </div>
    </div>
  );
};

export default SchedulerStats;
