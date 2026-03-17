import React, { useMemo, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { useTheme } from "../../hooks";
import { CheckCircle, BookOpen, TrendingUp, Clock, ChevronLeft, ChevronRight } from 'lucide-react';

interface KnowledgeHeatmapProps {
  graphData: Array<{
    id: string;
    title: string;
    nodes?: Array<{
      id: string;
      title: string;
      status: 'mastered' | 'learning' | 'new' | 'locked';
      level: string;
    }>;
    nodes_count?: number;
  }>;
}

interface WeakPoint {
  id: string;
  title: string;
  graphTitle: string;
  status: string;
  reviewCount: number;
  stability: number;
  suggestion: string;
}

export const KnowledgeHeatmap: React.FC<KnowledgeHeatmapProps> = ({ graphData }) => {
  const { isDark } = useTheme();
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const heatmapData = useMemo(() => {
    return graphData.map(graph => {
      const total = graph.nodes?.length || graph.nodes_count || 0;
      const mastered = graph.nodes?.filter(n => n.status === 'mastered').length || 0;
      const learning = graph.nodes?.filter(n => n.status === 'learning').length || 0;
      const newNodes = graph.nodes?.filter(n => n.status === 'new').length || 0;
      
      return {
        name: graph.title,
        id: graph.id,
        total,
        mastered,
        learning,
        new: newNodes,
        masteryRate: total > 0 ? Math.round((mastered / total) * 100) : 0
      };
    }).sort((a, b) => b.masteryRate - a.masteryRate);
  }, [graphData]);

  const totalPages = Math.ceil(heatmapData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return heatmapData.slice(start, start + itemsPerPage);
  }, [heatmapData, currentPage]);

  const getMasteryColor = (rate: number) => {
    if (rate >= 80) return 'bg-green-500';
    if (rate >= 60) return 'bg-green-400';
    if (rate >= 40) return 'bg-yellow-400';
    if (rate >= 20) return 'bg-orange-400';
    return 'bg-red-400';
  };

  return (
    <div className={`rounded-xl p-4 md:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-base md:text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
          知识掌握热力图
        </h3>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className={`text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className={`p-1 rounded-lg transition-colors ${
                currentPage === 1
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
              }`}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className={`p-1 rounded-lg transition-colors ${
                currentPage === totalPages
                  ? 'opacity-50 cursor-not-allowed'
                  : isDark ? 'hover:bg-slate-700' : 'hover:bg-gray-100'
              }`}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
        {paginatedData.map(item => (
          <div
            key={item.id}
            className={`relative p-2 md:p-3 rounded-lg border transition-all hover:scale-105 cursor-pointer ${
              isDark ? 'border-slate-600 hover:border-slate-500' : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between mb-1 md:mb-2">
              <span className={`text-[10px] md:text-xs font-medium truncate ${isDark ? 'text-slate-300' : 'text-gray-700'}`}>
                {item.name}
              </span>
              <span className={`text-[10px] md:text-xs font-bold ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {item.masteryRate}%
              </span>
            </div>
            
            <div className="h-1.5 md:h-2 rounded-full bg-gray-200 dark:bg-slate-700 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${getMasteryColor(item.masteryRate)}`}
                style={{ width: `${item.masteryRate}%` }}
              />
            </div>
            
            <div className="flex justify-between mt-1 md:mt-2 text-[8px] md:text-[10px]">
              <span className="text-green-500">{item.mastered} 已掌握</span>
              <span className="text-gray-400">{item.total} 节点</span>
            </div>
          </div>
        ))}
      </div>
      
      {heatmapData.length === 0 && (
        <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          暂无图谱数据
        </div>
      )}
    </div>
  );
};

export const MasteryDistributionChart: React.FC<{ distribution?: Array<{ name: string; value: number; color: string }> }> = ({ distribution }) => {
  const { isDark } = useTheme();

  const distributionData = distribution || [];
  const total = distributionData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className={`rounded-xl p-4 md:p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
      <h3 className={`text-base md:text-lg font-bold mb-4 ${isDark ? 'text-white' : 'text-gray-800'}`}>
        知识点掌握分布
      </h3>
      
      <div className="flex flex-col sm:flex-row items-center">
        <div className="w-32 h-32 md:w-40 md:h-40 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                innerRadius={30}
                outerRadius={50}
                paddingAngle={2}
                dataKey="value"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value} 个节点`, '']}
                contentStyle={{ 
                  borderRadius: '8px', 
                  border: 'none', 
                  boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  backgroundColor: isDark ? '#1e293b' : '#fff'
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 sm:ml-4 mt-4 sm:mt-0 space-y-2 w-full">
          {distributionData.map(item => (
            <div key={item.name} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className={`text-sm ${isDark ? 'text-slate-300' : 'text-gray-600'}`}>
                  {item.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                  {item.value}
                </span>
                <span className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                  ({total > 0 ? Math.round((item.value / total) * 100) : 0}%)
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const WeakPointsAnalysis: React.FC<{ 
  nodes: any[]; 
  nodeStatus: Record<string, any>;
  graphTitle?: string;
}> = ({ nodes, nodeStatus, graphTitle }) => {
  const { isDark } = useTheme();

  const weakPoints = useMemo(() => {
    const weak: WeakPoint[] = [];
    
    nodes.forEach(node => {
      const status = nodeStatus?.[node.id];
      if (!status) return;
      
      const isWeak = status.due_today || 
                     (status.review_count > 3 && !status.mastered) ||
                     (status.stability && status.stability < 7);
      
      if (isWeak && !status.mastered) {
        let suggestion = '';
        if (status.due_today) {
          suggestion = '今日需要复习，建议优先处理';
        } else if (status.review_count > 5) {
          suggestion = '复习次数较多但未掌握，建议重新学习内容';
        } else if (status.stability && status.stability < 3) {
          suggestion = '记忆稳定性较低，建议增加复习频率';
        } else {
          suggestion = '需要加强学习';
        }
        
        weak.push({
          id: node.id,
          title: node.title,
          graphTitle: graphTitle || '未知图谱',
          status: status.mastered ? 'mastered' : status.locked ? 'locked' : 'learning',
          reviewCount: status.review_count || 0,
          stability: status.stability || 0,
          suggestion
        });
      }
    });
    
    return weak.sort((a, b) => {
      if (a.stability !== b.stability) return a.stability - b.stability;
      return b.reviewCount - a.reviewCount;
    }).slice(0, 10);
  }, [nodes, nodeStatus, graphTitle]);

  return (
    <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
          薄弱知识点分析
        </h3>
        <span className={`text-xs px-2 py-1 rounded-full ${isDark ? 'bg-orange-900/30 text-orange-400' : 'bg-orange-100 text-orange-600'}`}>
          {weakPoints.length} 个需关注
        </span>
      </div>
      
      {weakPoints.length > 0 ? (
        <div className="space-y-3">
          {weakPoints.map((point, idx) => (
            <div 
              key={point.id}
              className={`p-3 rounded-lg border ${isDark ? 'border-slate-700 bg-slate-700/30' : 'border-gray-100 bg-gray-50'}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      #{idx + 1}
                    </span>
                    <span className={`font-medium ${isDark ? 'text-white' : 'text-gray-800'}`}>
                      {point.title}
                    </span>
                  </div>
                  <p className={`text-xs mt-1 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                    {point.suggestion}
                  </p>
                </div>
                <div className="text-right">
                  <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                    复习 {point.reviewCount} 次
                  </div>
                  {point.stability > 0 && (
                    <div className={`text-xs ${isDark ? 'text-slate-500' : 'text-gray-400'}`}>
                      稳定性: {point.stability.toFixed(1)}天
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={`text-center py-8 ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          <CheckCircle size={32} className="mx-auto mb-2 text-green-500" />
          <p>太棒了！暂无明显薄弱知识点</p>
        </div>
      )}
    </div>
  );
};

export const LearningTimeTrend: React.FC<{ data: Array<{ date: string; minutes: number }> }> = ({ data }) => {
  const { isDark } = useTheme();

  const chartData = useMemo(() => {
    return data.map(d => ({
      ...d,
      hours: Math.round(d.minutes / 60 * 10) / 10
    }));
  }, [data]);

  const totalHours = useMemo(() => {
    return Math.round(data.reduce((sum, d) => sum + d.minutes, 0) / 60 * 10) / 10;
  }, [data]);

  return (
    <div className={`rounded-xl p-6 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-lg font-bold ${isDark ? 'text-white' : 'text-gray-800'}`}>
          学习时间趋势
        </h3>
        <div className={`text-sm ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
          近7天共 <span className="font-bold text-blue-500">{totalHours}</span> 小时
        </div>
      </div>
      
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#334155' : '#f1f5f9'} />
            <XAxis 
              dataKey="date" 
              tickFormatter={(v) => new Date(v).toLocaleDateString('zh-CN', { weekday: 'short' })}
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? '#94a3b8' : '#64748b', fontSize: 11 }}
              tickFormatter={(v) => `${v}h`}
            />
            <Tooltip 
              formatter={(value) => [`${value} 小时`, '学习时间']}
              labelFormatter={(label) => new Date(label).toLocaleDateString('zh-CN')}
              contentStyle={{ 
                borderRadius: '8px', 
                border: 'none', 
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                backgroundColor: isDark ? '#1e293b' : '#fff'
              }}
            />
            <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={24} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export const QuickStatsCards: React.FC<{ 
  totalNodes: number; 
  masteredNodes: number;
  dueToday: number;
  streak: number;
}> = ({ totalNodes, masteredNodes, dueToday, streak }) => {
  const { isDark } = useTheme();

  const stats = [
    {
      label: '知识点总数',
      value: totalNodes,
      icon: BookOpen,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10'
    },
    {
      label: '已掌握',
      value: masteredNodes,
      icon: CheckCircle,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      subtext: totalNodes > 0 ? `${Math.round((masteredNodes / totalNodes) * 100)}%` : '0%'
    },
    {
      label: '今日待复习',
      value: dueToday,
      icon: Clock,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10'
    },
    {
      label: '连续学习',
      value: streak,
      icon: TrendingUp,
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
      subtext: '天'
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
      {stats.map(stat => (
        <div 
          key={stat.label}
          className={`rounded-xl p-3 md:p-4 ${isDark ? 'bg-slate-800' : 'bg-white'} shadow-sm border ${isDark ? 'border-slate-700' : 'border-gray-100'}`}
        >
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <p className={`text-[10px] md:text-xs ${isDark ? 'text-slate-400' : 'text-gray-500'}`}>
                {stat.label}
              </p>
              <p className={`text-xl md:text-2xl font-bold mt-1 ${isDark ? 'text-white' : 'text-gray-800'}`}>
                {stat.value}
                {stat.subtext && <span className="text-xs font-normal ml-1">{stat.subtext}</span>}
              </p>
            </div>
            <div className={`p-1.5 md:p-2 rounded-lg ${stat.bgColor} flex-shrink-0 ml-2`}>
              <stat.icon size={16} className={`${stat.color} md:w-5 md:h-5`} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
