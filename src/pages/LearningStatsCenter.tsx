import { useMemo } from 'react';
import { useStatistics, useUser, useGraphs } from '../hooks/queries';
import { ActivityHeatmap } from '../components/Statistics/ActivityHeatmap';
import {
  KnowledgeHeatmap,
  MasteryDistributionChart,
  QuickStatsCards
} from '../components/Statistics/LearningStatsEnhanced';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, LineChart, Line, ReferenceLine
} from 'recharts';
import { BookOpen, Brain, Clock, TrendingUp, Zap, Target } from 'lucide-react';
import { useTheme } from '../hooks';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';

const MetricCard = ({ title, value, subtext, icon: Icon, color, isDark }: any) => (
  <div className={`p-6 rounded-xl shadow-sm border flex items-start justify-between ${
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
  }`}>
    <div>
      <p className={`text-sm font-medium mb-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>{title}</p>
      <h3 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>{value}</h3>
      {subtext && <p className={`text-xs mt-2 ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>{subtext}</p>}
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

const ForecastChart = ({ data, isDark }: { data: any[], isDark: boolean }) => (
  <div className={`p-6 rounded-xl shadow-sm border h-80 flex flex-col ${
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
  }`}>
    <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>未来7天复习预测</h3>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => `${new Date(value).getDate()}日`}
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
            contentStyle={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: isDark ? '#1e293b' : '#fff'
            }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} name="复习卡片数" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const ForgettingCurveChart = ({ retentionThreshold, avgStability, isDark }: { retentionThreshold: number, avgStability: number, isDark: boolean }) => {
  const data = useMemo(() => {
    const points = [];
    const stability = avgStability > 0 ? avgStability : 7;
    for (let t = 0; t <= 30; t += 0.5) {
      const r = Math.exp(-t / stability);
      points.push({
        day: t,
        retention: Math.round(r * 100),
      });
    }
    return points;
  }, [avgStability]);

  return (
    <div className={`p-6 rounded-xl shadow-sm border h-80 flex flex-col ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
    }`}>
      <h3 className={`text-lg font-bold mb-2 ${isDark ? 'text-white' : 'text-gray-800'}`}>遗忘曲线与记忆阈值</h3>
      <p className={`text-xs mb-6 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
        基于 FSRS 算法的理论模型 (平均稳定性: {avgStability > 0 ? avgStability.toFixed(1) : 7}天)
      </p>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
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
              formatter={(value) => [`${value}%`, '记忆保留率']}
              labelFormatter={(label) => `第 ${label} 天`}
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: isDark ? '#1e293b' : '#fff'
              }}
            />
            <ReferenceLine 
              y={retentionThreshold * 100} 
              stroke="#ef4444" 
              strokeDasharray="3 3" 
              label={{ value: `目标 ${retentionThreshold * 100}%`, position: 'right', fill: '#ef4444', fontSize: 10 }} 
            />
            <Line 
              type="monotone" 
              dataKey="retention" 
              stroke="#6366f1" 
              strokeWidth={3} 
              dot={false}
              name="记忆保留率"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const GrowthChart = ({ data, isDark }: { data: any[], isDark: boolean }) => (
  <div className={`p-6 rounded-xl shadow-sm border h-80 flex flex-col ${
    isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
  }`}>
    <h3 className={`text-lg font-bold mb-6 ${isDark ? 'text-white' : 'text-gray-800'}`}>知识积累趋势 (近30天)</h3>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGrowthStats" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
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
            contentStyle={{ 
              borderRadius: '8px', 
              border: 'none', 
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              backgroundColor: isDark ? '#1e293b' : '#fff'
            }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorGrowthStats)" 
            name="新增卡片"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const FocusStatsCard = ({ stats, isDark }: { stats: any, isDark: boolean }) => {
  if (!stats) return null;
  
  return (
    <div className={`p-6 rounded-xl shadow-sm border ${
      isDark ? 'bg-slate-800 border-slate-700' : 'bg-white border-gray-100'
    }`}>
      <h3 className={`text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
        专注统计
      </h3>
      <div className="grid grid-cols-3 gap-4">
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Clock size={16} className="text-blue-500" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>今日专注</span>
          </div>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {stats.today?.minutes || 0} 分钟
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {stats.today?.sessions || 0} 次会话
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-amber-500" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>累计专注</span>
          </div>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {((stats.total?.minutes || 0) / 60).toFixed(1)} 小时
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
            {stats.total?.sessions || 0} 次会话
          </p>
        </div>
        <div className={`p-4 rounded-xl ${isDark ? 'bg-slate-700/50' : 'bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-2">
            <Target size={16} className="text-emerald-500" />
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>平均时长</span>
          </div>
          <p className={`text-xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
            {stats.total?.sessions ? Math.round(stats.total.minutes / stats.total.sessions) : 0} 分钟
          </p>
          <p className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>每次会话</p>
        </div>
      </div>
    </div>
  );
};

export const LearningStatsCenter = () => {
  const { isDark } = useTheme();
  const { data: stats, isLoading, error } = useStatistics();
  const { data: userData } = useUser();
  const { data: graphsData } = useGraphs();
  const retention = userData?.user?.profile?.settings?.request_retention || 0.9;

  const { data: focusStats } = useQuery({
    queryKey: ['focus-stats'],
    queryFn: async () => {
      try {
        const res = await api.focus.getStats();
        return res.data;
      } catch {
        return null;
      }
    }
  });

  const totalNodesCount = useMemo(() => {
    if (!graphsData) return 0;
    return graphsData.reduce((sum: number, g: any) => sum + (g.nodes_count || 0), 0);
  }, [graphsData]);

  const graphHeatmapData = useMemo(() => {
    if (!graphsData) return [];
    return graphsData.map((graph: any) => ({
      id: graph.id,
      title: graph.title,
      nodes: [],
      nodes_count: graph.nodes_count || 0
    }));
  }, [graphsData]);

  const distributionData = useMemo(() => {
    if (!stats?.distribution) return [];
    return stats.distribution.map((item: any) => ({
      name: item.name,
      value: item.value,
      color: item.color
    }));
  }, [stats]);

  if (isLoading) return <div className="p-8 text-center text-gray-500 dark:text-slate-400">加载统计数据中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">无法加载统计数据</div>;
  if (!stats) return null;

  return (
    <div className={`h-full overflow-y-auto p-8 ${isDark ? 'bg-slate-900' : 'bg-slate-50'}`}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>学习统计中心</h1>
          <p className={`mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>全面掌握您的学习进度和知识库状态</p>
        </div>

        <div className="space-y-8">
          <QuickStatsCards 
            totalNodes={totalNodesCount}
            masteredNodes={stats.metrics.learning}
            dueToday={stats.metrics.dueToday}
            streak={userData?.user?.profile?.study_streak || 0}
          />

          {focusStats && (
            <FocusStatsCard stats={focusStats} isDark={isDark} />
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard 
              title="总卡片数" 
              value={stats.metrics.totalCards} 
              subtext="累计创建的知识点"
              icon={BookOpen} 
              color="bg-blue-500"
              isDark={isDark}
            />
            <MetricCard 
              title="今日待复习" 
              value={stats.metrics.dueToday} 
              subtext="保持记忆的关键"
              icon={Clock} 
              color="bg-amber-500"
              isDark={isDark}
            />
            <MetricCard 
              title="已掌握/学习中" 
              value={stats.metrics.learning} 
              subtext="正在内化的知识"
              icon={Brain} 
              color="bg-green-500"
              isDark={isDark}
            />
            <MetricCard 
              title="平均记忆稳定性" 
              value={stats.metrics.avgStability} 
              subtext="天 (FSRS算法估算)"
              icon={TrendingUp} 
              color="bg-indigo-500"
              isDark={isDark}
            />
          </div>

          <ActivityHeatmap data={stats.heatmap || []} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <KnowledgeHeatmap graphData={graphHeatmapData} />
            <MasteryDistributionChart distribution={distributionData} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ForecastChart data={stats.forecast || []} isDark={isDark} />
            <ForgettingCurveChart 
              retentionThreshold={retention} 
              avgStability={stats.metrics.avgStability}
              isDark={isDark}
            />
          </div>

          <GrowthChart data={stats.growth || []} isDark={isDark} />
        </div>
      </div>
    </div>
  );
};

export default LearningStatsCenter;
