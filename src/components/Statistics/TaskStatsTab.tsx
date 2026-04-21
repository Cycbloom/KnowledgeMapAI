import React, { useState, useEffect, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
} from "recharts";
import {
  Clock,
  CheckCircle,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  RefreshCw,
  Activity,
  Calendar,
  Target,
} from "lucide-react";
import { useTranslation } from 'react-i18next';
import { useTheme } from "../../hooks";
import { api } from '../../services/api';

interface TaskAnalyticsResponse {
  overview: {
    todayCompleted: number;
    weekCompleted: number;
    monthCompleted: number;
    avgDuration: number;
    totalTasks: number;
    completionRate: number;
  };
  completionTrend: Array<{
    date: string;
    completed: number;
    total: number;
    cumulative: number;
  }>;
  timeDistribution: Array<{
    day: number;
    hour: number;
    value: number;
  }>;
  queueStats: Array<{
    queueLevel: number;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    avgDuration: number;
  }>;
  tagStats: Array<{
    tag: string;
    count: number;
    completedCount: number;
    completionRate: number;
  }>;
  priorityStats: Array<{
    priority: number;
    label: string;
    count: number;
    completedCount: number;
    completionRate: number;
    avgDelay: number;
  }>;
  comparison: {
    previousPeriod: {
      completed: number;
      completionRate: number;
      avgDuration: number;
    };
    change: {
      completedChange: number;
      completionRateChange: number;
      avgDurationChange: number;
    };
  };
}

interface Insight {
  type: "positive" | "negative" | "neutral";
  title: string;
  description: string;
  recommendation?: string;
}

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtext?: string;
  icon: React.ReactNode;
  color: string;
  change?: number;
}> = ({ title, value, subtext, icon, color, change }) => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  return (
    <div
      className={`p-4 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p
            className={`text-xs font-medium ${isDark ? "text-slate-400" : "text-gray-500"}`}
          >
            {title}
          </p>
          <h3
            className={`text-xl md:text-2xl font-bold mt-1 ${isDark ? "text-white" : "text-gray-900"}`}
          >
            {value}
          </h3>
          {subtext && (
            <p
              className={`text-xs mt-1 ${isDark ? "text-slate-500" : "text-gray-400"}`}
            >
              {subtext}
            </p>
          )}
        </div>
        <div className={`p-2 rounded-full ${color} flex-shrink-0 ml-2`}>{icon}</div>
      </div>
      {change !== undefined && (
        <div
          className={`flex items-center gap-1 mt-2 text-xs ${change >= 0 ? "text-green-500" : "text-red-500"}`}
        >
          {change >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>
            {change >= 0 ? "+" : ""}
            {change}% {t('stats.task.vsLastWeek')}
          </span>
        </div>
      )}
    </div>
  );
};

const CompletionTrendChart: React.FC<{
  data: TaskAnalyticsResponse["completionTrend"];
  isDark: boolean;
}> = ({ data, isDark }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`p-4 md:p-6 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <h3
        className={`text-base md:text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}
      >
        {t('stats.task.completionTrend')}
      </h3>
      <div className="h-48 md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? "#334155" : "#e5e7eb"}
            />
            <XAxis
              dataKey="date"
              tickFormatter={(value) => {
                const date = new Date(value);
                return `${date.getMonth() + 1}/${date.getDate()}`;
              }}
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 10 }}
              width={30}
            />
            <RechartsTooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                backgroundColor: isDark ? "#1e293b" : "#fff",
              }}
            />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="#8b5cf6"
              strokeWidth={2}
              fill="url(#colorCompleted)"
              name={t('stats.task.completed')}
            />
            <Line
              type="monotone"
              dataKey="cumulative"
              stroke="#10b981"
              strokeWidth={2}
              dot={false}
              name={t('stats.task.cumulative')}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const TimeDistributionHeatmap: React.FC<{
  data: TaskAnalyticsResponse["timeDistribution"];
  isDark: boolean;
}> = ({ data, isDark }) => {
  const { t } = useTranslation();
  const days = [
    t('stats.task.days.mon'),
    t('stats.task.days.tue'),
    t('stats.task.days.wed'),
    t('stats.task.days.thu'),
    t('stats.task.days.fri'),
    t('stats.task.days.sat'),
    t('stats.task.days.sun')
  ];
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const getHeatmapColor = (value: number) => {
    if (value === 0) return isDark ? "#1e293b" : "#f8fafc";
    if (value <= 2) return isDark ? "#164e63" : "#dbeafe";
    if (value <= 4) return isDark ? "#0891b2" : "#93c5fd";
    if (value <= 6) return isDark ? "#0284c7" : "#3b82f6";
    return isDark ? "#1e40af" : "#1d4ed8";
  };

  const heatmapData = useMemo(() => {
    const map: Record<string, number> = {};
    data.forEach((d) => {
      map[`${d.day}-${d.hour}`] = d.value;
    });
    return map;
  }, [data]);

  return (
    <div
      className={`p-4 md:p-6 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <h3
        className={`text-base md:text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}
      >
        {t('stats.task.timeDistribution')}
      </h3>
      <div className="overflow-x-auto -mx-4 md:mx-0 px-4 md:px-0">
        <div className="min-w-[500px] md:min-w-[600px]">
          <div className="flex">
            <div className="w-10 md:w-12" />
            {hours.map((h) => (
              <div
                key={h}
                className={`w-6 md:w-8 text-center text-[10px] md:text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}
              >
                {h}
              </div>
            ))}
          </div>
          {days.map((day, dayIndex) => (
            <div key={day} className="flex items-center">
              <div
                className={`w-10 md:w-12 text-[10px] md:text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
              >
                {day}
              </div>
              {hours.map((h) => {
                const value = heatmapData[`${dayIndex}-${h}`] || 0;
                return (
                  <div
                    key={h}
                    className="w-6 h-5 md:w-8 md:h-6 m-0.5 rounded-sm transition-colors"
                    style={{ backgroundColor: getHeatmapColor(value) }}
                    title={`${day} ${h}:00 - ${t('stats.task.completed', { count: value })}`}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-end gap-1 md:gap-2 mt-4">
        <span
          className={`text-[10px] md:text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}
        >
          {t('stats.task.less')}
        </span>
        {[0, 2, 4, 6, 8].map((v) => (
          <div
            key={v}
            className="w-3 h-3 md:w-4 md:h-4 rounded-sm"
            style={{ backgroundColor: getHeatmapColor(v) }}
          />
        ))}
        <span
          className={`text-[10px] md:text-xs ${isDark ? "text-slate-500" : "text-gray-400"}`}
        >
          {t('stats.task.more')}
        </span>
      </div>
    </div>
  );
};

const QueueEfficiencyChart: React.FC<{
  data: TaskAnalyticsResponse["queueStats"];
  isDark: boolean;
}> = ({ data, isDark }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`p-6 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <h3
        className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}
      >
        {t('stats.task.queueEfficiency')}
      </h3>
      <div className="space-y-4">
        {data.map((queue) => (
          <div
            key={queue.queueLevel}
            className={`p-4 rounded-lg ${isDark ? "bg-slate-700/50" : "bg-gray-50"}`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded text-xs font-medium ${
                    queue.queueLevel === 0
                      ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400"
                      : queue.queueLevel === 1
                        ? "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400"
                        : "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                  }`}
                >
                  Q{queue.queueLevel}
                </span>
                <span
                  className={`text-sm ${isDark ? "text-slate-300" : "text-gray-600"}`}
                >
                  {queue.queueLevel === 0
                    ? t('stats.task.focusQueue')
                    : queue.queueLevel === 1
                      ? t('stats.task.standardQueue')
                      : t('stats.task.backgroundQueue')}
                </span>
              </div>
              <span
                className={`text-sm font-medium ${isDark ? "text-white" : "text-gray-900"}`}
              >
                {queue.completedTasks}/{queue.totalTasks} {t('stats.task.tasks')}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div
                  className={`h-2 rounded-full ${isDark ? "bg-slate-600" : "bg-gray-200"}`}
                >
                  <div
                    className="h-full rounded-full bg-primary-500"
                    style={{ width: `${queue.completionRate}%` }}
                  />
                </div>
              </div>
              <span
                className={`text-sm font-medium ${isDark ? "text-slate-300" : "text-gray-600"}`}
              >
                {queue.completionRate.toFixed(0)}%
              </span>
            </div>
            <div
              className={`flex gap-4 mt-2 text-xs ${isDark ? "text-slate-400" : "text-gray-500"}`}
            >
              <span>{t('stats.task.avgDuration')}: {queue.avgDuration}{t('stats.task.minutes')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const TagAnalysisChart: React.FC<{
  data: TaskAnalyticsResponse["tagStats"];
  isDark: boolean;
}> = ({ data, isDark }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`p-6 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <h3
        className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}
      >
        {t('stats.task.tagAnalysis')}
      </h3>
      <div className="grid grid-cols-2 gap-4">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 6)} layout="vertical">
              <CartesianGrid
                strokeDasharray="3 3"
                horizontal={false}
                stroke={isDark ? "#334155" : "#e5e7eb"}
              />
              <XAxis type="number" axisLine={false} tickLine={false} />
              <YAxis
                type="category"
                dataKey="tag"
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
                width={60}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                }}
                formatter={(value) => [
                  `${Number(value || 0).toFixed(0)}%`,
                  t('stats.task.completionRate'),
                ]}
              />
              <Bar
                dataKey="completionRate"
                fill="#8b5cf6"
                radius={[0, 4, 4, 0]}
                barSize={16}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.slice(0, 6)}>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke={isDark ? "#334155" : "#e5e7eb"}
              />
              <XAxis
                dataKey="tag"
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}
              />
              <RechartsTooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  backgroundColor: isDark ? "#1e293b" : "#fff",
                }}
              />
              <Bar
                dataKey="count"
                name={t('stats.task.taskCount')}
                fill="#8b5cf6"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                dataKey="completedCount"
                name={t('stats.task.completedCount')}
                fill="#10b981"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

const PriorityAnalysisChart: React.FC<{
  data: TaskAnalyticsResponse["priorityStats"];
  isDark: boolean;
}> = ({ data, isDark }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`p-6 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <h3
        className={`text-lg font-bold mb-4 ${isDark ? "text-white" : "text-gray-800"}`}
      >
        {t('stats.task.priorityAnalysis')}
      </h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              vertical={false}
              stroke={isDark ? "#334155" : "#e5e7eb"}
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: isDark ? "#94a3b8" : "#64748b", fontSize: 12 }}
            />
            <RechartsTooltip
              contentStyle={{
                borderRadius: "8px",
                border: "none",
                backgroundColor: isDark ? "#1e293b" : "#fff",
              }}
            />
            <Bar
              dataKey="count"
              name={t('stats.task.taskCount')}
              fill="#8b5cf6"
              radius={[4, 4, 0, 0]}
            />
            <Bar
              dataKey="completedCount"
              name={t('stats.task.completedCount')}
              fill="#10b981"
              radius={[4, 4, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const SmartInsightsPanel: React.FC<{
  insights: Insight[];
  loading: boolean;
  onGenerate: () => void;
  isDark: boolean;
}> = ({ insights, loading, onGenerate, isDark }) => {
  const { t } = useTranslation();
  return (
    <div
      className={`p-6 rounded-xl border ${isDark ? "bg-slate-800 border-slate-700" : "bg-white border-gray-100"}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Lightbulb
            className={isDark ? "text-yellow-400" : "text-yellow-500"}
            size={20}
          />
          <h3
            className={`text-lg font-bold ${isDark ? "text-white" : "text-gray-800"}`}
          >
            {t('stats.task.smartInsights')}
          </h3>
        </div>
        <button
          onClick={onGenerate}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            loading
              ? "bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
              : "bg-primary-600 text-white hover:bg-primary-700"
          }`}
        >
          {loading ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
          ) : (
            <RefreshCw size={16} />
          )}
          {loading ? t('stats.task.generating') : t('stats.task.regenerate')}
        </button>
      </div>

      {insights.length === 0 ? (
        <div
          className={`text-center py-8 ${isDark ? "text-slate-400" : "text-gray-500"}`}
        >
          <Lightbulb size={32} className="mx-auto mb-2 opacity-50" />
          <p>{t('stats.task.noInsights')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className={`p-4 rounded-lg ${
                insight.type === "positive"
                  ? "bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/30"
                  : insight.type === "negative"
                    ? "bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30"
                    : "bg-primary-50 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/30"
              }`}
            >
              <div className="flex items-start gap-3">
                {insight.type === "positive" ? (
                  <TrendingUp className="text-green-500 mt-0.5" size={16} />
                ) : insight.type === "negative" ? (
                  <TrendingDown className="text-red-500 mt-0.5" size={16} />
                ) : (
                  <Activity className="text-primary-500 mt-0.5" size={16} />
                )}
                <div>
                  <h4
                    className={`font-medium ${
                      insight.type === "positive"
                        ? "text-green-700 dark:text-green-400"
                        : insight.type === "negative"
                          ? "text-red-700 dark:text-red-400"
                          : "text-primary-700 dark:text-primary-400"
                    }`}
                  >
                    {insight.title}
                  </h4>
                  <p
                    className={`text-sm mt-1 ${
                      insight.type === "positive"
                        ? "text-green-600 dark:text-green-300"
                        : insight.type === "negative"
                          ? "text-red-600 dark:text-red-300"
                          : "text-primary-600 dark:text-primary-300"
                    }`}
                  >
                    {insight.description}
                  </p>
                  {insight.recommendation && (
                    <p
                      className={`text-xs mt-2 ${
                        insight.type === "positive"
                          ? "text-green-500 dark:text-green-400"
                          : insight.type === "negative"
                            ? "text-red-500 dark:text-red-400"
                            : "text-primary-500 dark:text-primary-400"
                      }`}
                    >
                      💡 {insight.recommendation}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const TaskStatsTab: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const [analytics, setAnalytics] = useState<TaskAnalyticsResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [insightsLoading, setInsightsLoading] = useState(false);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const response = await api.scheduler.getTaskAnalytics();
      if (response.success) {
        setAnalytics(response.data);
      }
    } catch (error) {
      console.error("Failed to load analytics:", error);
    } finally {
      setLoading(false);
    }
  };

  const generateInsights = async () => {
    if (!analytics) return;

    setInsightsLoading(true);
    try {
      const response = await api.scheduler.generateInsights();
      if (response.success) {
        setInsights(response.data);
      }
    } catch (error) {
      console.error("Failed to generate insights:", error);
    } finally {
      setInsightsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!analytics) {
    return (
      <div
        className={`text-center py-20 ${isDark ? "text-slate-400" : "text-gray-500"}`}
      >
        <Activity size={48} className="mx-auto mb-4 opacity-50" />
        <p>{t('stats.task.loadFailed')}</p>
      </div>
    );
  }

  const {
    overview,
    completionTrend,
    timeDistribution,
    queueStats,
    tagStats,
    priorityStats,
    comparison,
  } = analytics;

  return (
    <div className="space-y-6">
      {/* Efficiency Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <MetricCard
          title={t('stats.metric.todayCompleted')}
          value={overview.todayCompleted}
          subtext={t('stats.metric.tasks')}
          icon={<CheckCircle size={18} className="text-white" />}
          color="bg-green-500"
          change={comparison?.change?.completedChange}
        />
        <MetricCard
          title={t('stats.metric.weekCompleted')}
          value={overview.weekCompleted}
          subtext={t('stats.metric.tasks')}
          icon={<Calendar size={18} className="text-white" />}
          color="bg-primary-500"
        />
        <MetricCard
          title={t('stats.metric.monthCompleted')}
          value={overview.monthCompleted}
          subtext={t('stats.metric.tasks')}
          icon={<Target size={18} className="text-white" />}
          color="bg-primary-500"
        />
        <MetricCard
          title={t('stats.metric.avgDuration')}
          value={overview.avgDuration}
          subtext={t('stats.metric.minutes')}
          icon={<Clock size={18} className="text-white" />}
          color="bg-amber-500"
          change={comparison?.change?.avgDurationChange}
        />
      </div>

      {/* Completion Trend & Time Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CompletionTrendChart data={completionTrend} isDark={isDark} />
        <TimeDistributionHeatmap data={timeDistribution} isDark={isDark} />
      </div>

      {/* Queue Efficiency & Tag Analysis */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <QueueEfficiencyChart data={queueStats} isDark={isDark} />
        <TagAnalysisChart data={tagStats} isDark={isDark} />
      </div>

      {/* Priority Analysis */}
      <PriorityAnalysisChart data={priorityStats} isDark={isDark} />

      {/* Smart Insights */}
      <SmartInsightsPanel
        insights={insights}
        loading={insightsLoading}
        onGenerate={generateInsights}
        isDark={isDark}
      />
    </div>
  );
};

