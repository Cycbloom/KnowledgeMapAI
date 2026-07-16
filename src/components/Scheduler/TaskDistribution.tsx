import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PieChart, BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { api } from '../../services/api';
import { EmptyState } from '../common/EmptyState';
import type {UserTask} from '@shared/types';

interface TaskDistributionProps {
  className?: string;
}

interface TagDistribution {
  tag: string;
  count: number;
  duration: number;
  percentage: number;
  color: string;
}

const TAG_COLORS = [
  "#06b6d4",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#6366f1",
  "#14b8a6",
  "#f97316",
  "#84cc16",
];

export const TaskDistribution: React.FC<TaskDistributionProps> = ({
  className = "",
}) => {
  const { t } = useTranslation();
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const { tasks: allTasks } = await api.scheduler.list({
        status: "all",
      });
      setTasks(allTasks);
    } catch (error) {
      console.error("Failed to load task distribution:", error);
    } finally {
      setLoading(false);
    }
  };

  const getDistribution = (): TagDistribution[] => {
    const tagMap = new Map<string, { count: number; duration: number }>();

    tasks.forEach((task) => {
      if (task.tags && task.tags.length > 0) {
        task.tags.forEach((tag) => {
          const existing = tagMap.get(tag) || { count: 0, duration: 0 };
          tagMap.set(tag, {
            count: existing.count + 1,
            duration: existing.duration + (task.actual_duration || 0),
          });
        });
      } else {
        const existing = tagMap.get("未分类") || { count: 0, duration: 0 };
        tagMap.set("未分类", {
          count: existing.count + 1,
          duration: existing.duration + (task.actual_duration || 0),
        });
      }
    });

    const total = Array.from(tagMap.values()).reduce(
      (sum, v) => sum + v.count,
      0,
    );

    return Array.from(tagMap.entries())
      .map(([tag, data], index) => ({
        tag,
        count: data.count,
        duration: data.duration,
        percentage: total > 0 ? (data.count / total) * 100 : 0,
        color: TAG_COLORS[index % TAG_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  };

  const distribution = getDistribution();

  // 保留本地实现：< 60 分钟使用中文，>= 60 分钟使用带空格紧凑格式 "Xh Ym"，混合格式无法直接复用 @/utils/formatters
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const renderPieChart = () => {
    let currentAngle = 0;
    const radius = 80;
    const center = 100;

    return (
      <svg width="200" height="200" viewBox="0 0 200 200">
        {distribution.map((item, index) => {
          const angle = (item.percentage / 100) * 360;
          const startAngle = currentAngle;
          currentAngle += angle;

          const startRad = (startAngle - 90) * (Math.PI / 180);
          const endRad = (currentAngle - 90) * (Math.PI / 180);

          const x1 = center + radius * Math.cos(startRad);
          const y1 = center + radius * Math.sin(startRad);
          const x2 = center + radius * Math.cos(endRad);
          const y2 = center + radius * Math.sin(endRad);

          const largeArc = angle > 180 ? 1 : 0;

          const pathD =
            item.percentage === 100
              ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
              : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

          return (
            <motion.path
              key={index}
              d={pathD}
              fill={item.color}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
              className="cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() =>
                setSelectedTag(item.tag === selectedTag ? null : item.tag)
              }
            />
          );
        })}
        <circle
          cx={center}
          cy={center}
          r="40"
          fill="white"
          className="dark:fill-slate-900"
        />
      </svg>
    );
  };

  return (
    <div
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 ${className}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary-100 dark:bg-primary-500/20 rounded-xl">
          <PieChart size={20} className="text-primary-500" />
        </div>
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">
            任务分布
          </h3>
          <p className="text-xs text-slate-500">按标签分类统计</p>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
        </div>
      ) : distribution.length === 0 ? (
        <EmptyState
          icon={<BarChart3 size={32} />}
          title={t('scheduler.empty.distributionEmpty')}
        />
      ) : (
        <div className="flex items-center gap-6">
          <div className="flex-shrink-0">{renderPieChart()}</div>

          <div className="flex-1 space-y-2">
            {distribution.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedTag === item.tag
                    ? "bg-slate-100 dark:bg-slate-800"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
                }`}
                onClick={() =>
                  setSelectedTag(item.tag === selectedTag ? null : item.tag)
                }
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">
                    {item.tag}
                  </div>
                  <div className="text-xs text-slate-400">
                    {item.count} 个任务 · {formatDuration(item.duration)}
                  </div>
                </div>
                <div className="text-sm font-medium text-slate-500">
                  {item.percentage.toFixed(1)}%
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
