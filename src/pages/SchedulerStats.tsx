import { useMemo, useState } from 'react';
import { useSchedulerStats, useHeatmap, useExecutions } from '../hooks';
import type { ExecutionFilters, TaskExecution } from '@shared/types';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import {
  CheckCircle2, Clock, ListTodo, TrendingUp, Zap, Activity,
  Calendar, ChevronLeft, ChevronRight, Filter, RefreshCw
} from 'lucide-react';

const QUEUE_COLORS = {
  q0: { main: '#06b6d4', glow: 'rgba(6, 182, 212, 0.3)', bg: 'bg-primary-500' },
  q1: { main: '#8b5cf6', glow: 'rgba(139, 92, 246, 0.3)', bg: 'bg-violet-500' },
  q2: { main: '#f59e0b', glow: 'rgba(245, 158, 11, 0.3)', bg: 'bg-amber-500' },
};



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
  colorKey = 'q0',
  trend
}: { 
  title: string; 
  value: string | number; 
  subtext?: string; 
  icon: React.ElementType; 
  colorKey?: 'q0' | 'q1' | 'q2';
  trend?: number;
}) => {
  const colors = QUEUE_COLORS[colorKey];
  
  return (
    <TechCard className="p-6 relative overflow-hidden group" glow>
      <div 
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `radial-gradient(circle at top right, ${colors.glow}, transparent 70%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`p-3 rounded-lg ${colors.bg} shadow-lg`} style={{ boxShadow: `0 0 20px ${colors.glow}` }}>
            <Icon size={24} className="text-white" />
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 text-sm ${trend >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              <TrendingUp size={14} className={trend < 0 ? 'rotate-180' : ''} />
              <span>{Math.abs(trend)}%</span>
            </div>
          )}
        </div>
        <h3 className="text-3xl font-bold text-white mb-1" style={{ textShadow: `0 0 20px ${colors.glow}` }}>
          {value}
        </h3>
        <p className="text-slate-400 text-sm">{title}</p>
        {subtext && <p className="text-slate-500 text-xs mt-1">{subtext}</p>}
      </div>
    </TechCard>
  );
};

const QueueDistributionChart = ({ data }: { data: { q0: number; q1: number; q2: number } }) => {
  const chartData = [
    { name: 'Q0 高优先', value: data.q0, color: QUEUE_COLORS.q0.main },
    { name: 'Q1 中优先', value: data.q1, color: QUEUE_COLORS.q1.main },
    { name: 'Q2 低优先', value: data.q2, color: QUEUE_COLORS.q2.main },
  ];

  return (
    <TechCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <Zap size={20} className="text-primary-400" />
        队列分布
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

const DailyTrendChart = ({ data }: { data: { date: string; completed: number; duration: number }[] }) => (
  <TechCard className="p-6">
    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
      <Activity size={20} className="text-emerald-400" />
      每日完成趋势
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
            tickFormatter={(value) => `${new Date(value).getDate()}日`}
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
            labelFormatter={(label) => new Date(label).toLocaleDateString('zh-CN')}
          />
          <Area 
            type="monotone" 
            dataKey="completed" 
            stroke="#10b981" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorCompleted)" 
            name="完成任务"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </TechCard>
);

const DurationTrendChart = ({ data }: { data: { date: string; completed: number; duration: number }[] }) => {
  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}小时${remainingMinutes}分钟`;
  };

  return (
    <TechCard className="p-6">
      <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
        <Clock size={20} className="text-violet-400" />
        执行时长趋势
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => `${new Date(value).getDate()}日`}
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
              formatter={(value) => value !== undefined ? [formatDuration(value as number), '执行时长'] : ['', '执行时长']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('zh-CN')}
            />
            <Line 
              type="monotone" 
              dataKey="duration" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              dot={{ fill: '#8b5cf6', strokeWidth: 0, r: 4 }}
              activeDot={{ r: 6, fill: '#8b5cf6' }}
              name="执行时长"
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

  const activityMap = new Map(data.map(d => [d.date, d]));

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

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h${remainingMinutes}m`;
  };

  const months = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];

  return (
    <TechCard className="p-6" glow>
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar size={20} className="text-primary-400" />
          任务执行热力图
        </h3>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => onYearChange(currentYear - 1)}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
            >
              <ChevronLeft size={18} className="text-slate-400" />
            </button>
            <span className="text-white font-medium min-w-[60px] text-center">{currentYear}</span>
            <button
              onClick={() => onYearChange(currentYear + 1)}
              className="p-1 rounded hover:bg-slate-700 transition-colors"
            >
              <ChevronRight size={18} className="text-slate-400" />
            </button>
          </div>
          <select
            value={currentMonth ?? ''}
            onChange={(e) => onMonthChange(e.target.value ? parseInt(e.target.value) : undefined)}
            className="bg-slate-700 text-white rounded-lg px-3 py-1 border border-slate-600 focus:outline-none focus:border-primary-500"
          >
            <option value="">全年</option>
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
              title={`${date}: ${count} 次执行, ${formatDuration(duration)}`}
            />
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span>活跃度:</span>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 bg-slate-700/50 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-900 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-700 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-500 rounded-sm"></div>
            <div className="w-3 h-3 bg-primary-400 rounded-sm"></div>
          </div>
        </div>
        <div className="text-xs text-slate-500">
          共 {data.reduce((sum, d) => sum + d.count, 0)} 次执行
        </div>
      </div>
    </TechCard>
  );
};

const ExecutionHistoryTable = ({ filters, onFiltersChange }: { 
  filters: ExecutionFilters;
  onFiltersChange: (filters: ExecutionFilters) => void;
}) => {
  const { data, isLoading, refetch } = useExecutions(filters);

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}分${remainingSeconds}秒`;
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      completed: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      interrupted: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      time_slice_ended: 'bg-primary-500/20 text-primary-400 border-primary-500/30',
    };
    const labels: Record<string, string> = {
      completed: '已完成',
      interrupted: '已中断',
      time_slice_ended: '时间片结束',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${styles[status] || 'bg-slate-500/20 text-slate-400'}`}>
        {labels[status] || status}
      </span>
    );
  };

  const getQueueBadge = (level: number) => {
    const colors = ['text-primary-400', 'text-violet-400', 'text-amber-400'];
    return (
      <span className={`font-mono ${colors[level]}`}>
        Q{level}
      </span>
    );
  };

  return (
    <TechCard className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <ListTodo size={20} className="text-primary-400" />
          执行历史
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-slate-400" />
            <select
              value={filters.status || ''}
              onChange={(e) => onFiltersChange({ ...filters, status: e.target.value || undefined })}
              className="bg-slate-700 text-white rounded-lg px-3 py-1 border border-slate-600 focus:outline-none focus:border-primary-500 text-sm"
            >
              <option value="">全部状态</option>
              <option value="completed">已完成</option>
              <option value="interrupted">已中断</option>
              <option value="time_slice_ended">时间片结束</option>
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
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">任务ID</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">开始时间</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">结束时间</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">执行时长</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">队列</th>
              <th className="text-left py-3 px-4 text-slate-400 font-medium text-sm">状态</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  加载中...
                </td>
              </tr>
            ) : !data || data.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-8 text-slate-400">
                  暂无执行记录
                </td>
              </tr>
            ) : (
              data.map((execution: TaskExecution) => (
                <tr key={execution.id} className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors">
                  <td className="py-3 px-4 text-slate-300 font-mono text-sm">
                    {execution.task_id.slice(0, 8)}...
                  </td>
                  <td className="py-3 px-4 text-slate-300 text-sm">
                    {formatDateTime(execution.started_at)}
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
        效率分析 (分钟/任务)
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={efficiencyData} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(100, 116, 139, 0.2)" />
            <XAxis 
              dataKey="date" 
              tickFormatter={(value) => `${new Date(value).getDate()}日`}
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
              formatter={(value) => value !== undefined ? [`${value} 分钟/任务`, '平均效率'] : ['', '平均效率']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('zh-CN')}
            />
            <Bar 
              dataKey="efficiency" 
              fill="#f59e0b" 
              radius={[4, 4, 0, 0]} 
              barSize={20}
              name="效率"
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </TechCard>
  );
};

export const SchedulerStats = () => {
  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('week');
  const [heatmapYear, setHeatmapYear] = useState(new Date().getFullYear());
  const [heatmapMonth, setHeatmapMonth] = useState<number | undefined>(undefined);
  const [executionFilters, setExecutionFilters] = useState<ExecutionFilters>({});

  const { data: stats, isLoading: statsLoading, error: statsError } = useSchedulerStats(period);
  const { data: heatmapData } = useHeatmap(heatmapYear, heatmapMonth);

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  if (statsLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-400">加载统计数据中...</p>
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
        <div className="text-center text-red-400">
          <p>无法加载统计数据</p>
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
          调度器统计
        </h1>
        <p className="text-slate-400">三层反馈队列任务调度系统运行数据</p>
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
            {p === 'day' ? '今日' : p === 'week' ? '本周' : p === 'month' ? '本月' : '本年'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <GlowingMetricCard
          title="总任务数"
          value={stats.total_tasks}
          subtext="统计周期内创建"
          icon={ListTodo}
          colorKey="q0"
        />
        <GlowingMetricCard
          title="已完成任务"
          value={stats.completed_tasks}
          subtext={`完成率 ${completionRate}%`}
          icon={CheckCircle2}
          colorKey="q1"
        />
        <GlowingMetricCard
          title="总执行时长"
          value={formatDuration(stats.total_duration)}
          subtext="累计执行时间"
          icon={Clock}
          colorKey="q2"
        />
        <GlowingMetricCard
          title="平均执行时长"
          value={stats.completed_tasks > 0 ? formatDuration(Math.round(stats.total_duration / stats.completed_tasks)) : '-'}
          subtext="每个任务平均"
          icon={TrendingUp}
          colorKey="q0"
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
