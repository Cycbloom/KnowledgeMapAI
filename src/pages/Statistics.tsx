import React from 'react';
import { useStatistics } from '../hooks/useQueries';
import { ActivityHeatmap } from '../components/ActivityHeatmap';
import { StatsOverview } from '../components/StatsOverview';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { BookOpen, Brain, Clock, TrendingUp } from 'lucide-react';

// --- Metric Card Component ---
const MetricCard = ({ title, value, subtext, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex items-start justify-between">
    <div>
      <p className="text-gray-500 text-sm font-medium mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-gray-800">{value}</h3>
      {subtext && <p className="text-gray-400 text-xs mt-2">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-full ${color}`}>
      <Icon size={24} className="text-white" />
    </div>
  </div>
);

// --- Forecast Chart Component ---
const ForecastChart = ({ data }: { data: any[] }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-80 flex flex-col">
    <h3 className="text-lg font-bold text-gray-800 mb-6">未来7天复习预测</h3>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value) => new Date(value).getDate().toString() + '日'}
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
            cursor={{ fill: '#f8fafc' }}
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={32} name="复习卡片数" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

// --- Growth Chart Component ---
const GrowthChart = ({ data }: { data: any[] }) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 h-80 flex flex-col">
    <h3 className="text-lg font-bold text-gray-800 mb-6">知识积累趋势 (近30天)</h3>
    <div className="flex-1 w-full min-h-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="colorGrowth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="date" 
            tickFormatter={(value, index) => index % 5 === 0 ? new Date(value).getMonth() + 1 + '/' + new Date(value).getDate() : ''}
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
            contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="#10b981" 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorGrowth)" 
            name="新增卡片"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
);

export const Statistics = () => {
  const { data: stats, isLoading, error } = useStatistics();

  if (isLoading) return <div className="p-8 text-center text-gray-500">加载统计数据中...</div>;
  if (error) return <div className="p-8 text-center text-red-500">无法加载统计数据</div>;
  if (!stats) return null;

  return (
    <div className="h-full overflow-y-auto p-8 bg-slate-50">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">学习统计分析</h1>
        <p className="text-gray-500 mt-2">全面掌握您的学习进度和知识库状态</p>
      </div>

      {/* 1. Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard 
          title="总卡片数" 
          value={stats.metrics.totalCards} 
          subtext="累计创建的知识点"
          icon={BookOpen} 
          color="bg-blue-500" 
        />
        <MetricCard 
          title="今日待复习" 
          value={stats.metrics.dueToday} 
          subtext="保持记忆的关键"
          icon={Clock} 
          color="bg-amber-500" 
        />
        <MetricCard 
          title="已掌握/学习中" 
          value={stats.metrics.learning} 
          subtext="正在内化的知识"
          icon={Brain} 
          color="bg-green-500" 
        />
        <MetricCard 
          title="平均记忆稳定性" 
          value={stats.metrics.avgStability} 
          subtext="天 (FSRS算法估算)"
          icon={TrendingUp} 
          color="bg-indigo-500" 
        />
      </div>

      {/* 2. Activity Heatmap */}
      <div className="mb-8">
        <ActivityHeatmap data={stats.heatmap || []} />
      </div>

      {/* 3. Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <ForecastChart data={stats.forecast || []} />
        <StatsOverview data={stats.distribution || []} />
      </div>

      {/* 4. Growth Chart (Full Width) */}
      <div className="mb-8">
        <GrowthChart data={stats.growth || []} />
      </div>
    </div>
  );
};

export default Statistics;
