import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Clock,
  Calendar,
  CheckCircle,
  Circle,
  Play,
  Pause,
  ExternalLink,
  Loader2,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { useSchedulerTasks } from "../../hooks";
import type { ScheduledTask, TaskStatus } from "@shared/types";

interface RelatedTasksProps {
  knowledgePointId: string;
  onTaskClick?: (taskId: string) => void;
  onCreateTask?: () => void;
}

const STATUS_CONFIG: Record<
  TaskStatus,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  pending: {
    label: "待处理",
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-700/50",
    borderColor: "border-slate-200 dark:border-slate-600",
  },
  in_progress: {
    label: "进行中",
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-500/20",
    borderColor: "border-blue-200 dark:border-blue-500/50",
  },
  paused: {
    label: "已暂停",
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-100 dark:bg-amber-500/20",
    borderColor: "border-amber-200 dark:border-amber-500/50",
  },
  completed: {
    label: "已完成",
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-100 dark:bg-emerald-500/20",
    borderColor: "border-emerald-200 dark:border-emerald-500/50",
  },
  cancelled: {
    label: "已取消",
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-500/20",
    borderColor: "border-red-200 dark:border-red-500/50",
  },
};

const QUEUE_COLORS = {
  0: {
    accent: "bg-cyan-500",
    text: "text-cyan-600 dark:text-cyan-400",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300",
  },
  1: {
    accent: "bg-emerald-500",
    text: "text-emerald-600 dark:text-emerald-400",
    badge:
      "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
  2: {
    accent: "bg-amber-500",
    text: "text-amber-600 dark:text-amber-400",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  },
};

const formatDuration = (minutes?: number): string => {
  if (!minutes) return "--";
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

const formatDeadline = (date?: string): { text: string; color: string } | null => {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: "已过期", color: "text-red-500 dark:text-red-400" };
  if (days === 0) return { text: "今天", color: "text-amber-500 dark:text-amber-400" };
  if (days === 1) return { text: "明天", color: "text-yellow-500 dark:text-yellow-400" };
  if (days <= 7) return { text: `${days}天后`, color: "text-blue-500 dark:text-blue-400" };
  return { text: d.toLocaleDateString(), color: "text-slate-500 dark:text-slate-400" };
};

const getStatusIcon = (status: TaskStatus) => {
  switch (status) {
    case "completed":
      return <CheckCircle size={16} className="text-emerald-500" />;
    case "in_progress":
      return <Play size={16} className="text-blue-500" />;
    case "paused":
      return <Pause size={16} className="text-amber-500" />;
    default:
      return <Circle size={16} className="text-slate-400" />;
  }
};

export const RelatedTasks: React.FC<RelatedTasksProps> = ({
  knowledgePointId,
  onTaskClick,
  onCreateTask,
}) => {
  const { data: tasksData, isLoading, error, refetch } = useSchedulerTasks();

  const relatedTasks = React.useMemo(() => {
    if (!tasksData?.data) return [];
    return tasksData.data.filter(
      (task: ScheduledTask) => task.knowledge_point_id === knowledgePointId
    );
  }, [tasksData, knowledgePointId]);

  const taskStats = React.useMemo(() => {
    const total = relatedTasks.length;
    const completed = relatedTasks.filter((t: ScheduledTask) => t.status === "completed").length;
    const inProgress = relatedTasks.filter((t: ScheduledTask) => t.status === "in_progress").length;
    const pending = relatedTasks.filter((t: ScheduledTask) => t.status === "pending").length;
    return { total, completed, inProgress, pending };
  }, [relatedTasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-cyan-500" />
        <span className="ml-2 text-slate-500 dark:text-slate-400">加载任务中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
        <AlertCircle size={24} className="text-red-500 mb-2" />
        <span>加载任务失败</span>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-cyan-500 hover:text-cyan-600"
        >
          重试
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 shadow-lg shadow-cyan-500/30">
            <ListTodo size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              关联任务
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {taskStats.total} 个任务 · {taskStats.completed} 已完成
            </p>
          </div>
        </div>
        {onCreateTask && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-sm font-medium shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50 transition-all"
          >
            <Plus size={16} />
            <span>新建</span>
          </motion.button>
        )}
      </div>

      {taskStats.total > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              待处理: {taskStats.pending}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              进行中: {taskStats.inProgress}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              已完成: {taskStats.completed}
            </span>
          </div>
          <div className="ml-auto">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {taskStats.total > 0
                ? Math.round((taskStats.completed / taskStats.total) * 100)
                : 0}
              % 完成
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {relatedTasks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400"
          >
            <ListTodo size={40} className="mb-3 opacity-50" />
            <p className="text-sm">暂无关联任务</p>
            {onCreateTask && (
              <button
                onClick={onCreateTask}
                className="mt-3 text-sm text-cyan-500 hover:text-cyan-600 flex items-center gap-1"
              >
                <Plus size={14} />
                创建新任务
              </button>
            )}
          </motion.div>
        ) : (
          <div className="space-y-2">
            {relatedTasks.map((task: ScheduledTask, index: number) => {
              const statusConfig = STATUS_CONFIG[task.status];
              const queueStyle =
                QUEUE_COLORS[task.queue_level as keyof typeof QUEUE_COLORS] ||
                QUEUE_COLORS[0];
              const deadlineInfo = formatDeadline(task.deadline);

              return (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ delay: index * 0.05 }}
                  onClick={() => onTaskClick?.(task.id)}
                  className={`
                    group relative rounded-xl border transition-all duration-200 cursor-pointer
                    hover:shadow-lg hover:scale-[1.01]
                    bg-white dark:bg-slate-900/80 backdrop-blur-sm
                    ${statusConfig.borderColor}
                  `}
                >
                  <div
                    className={`absolute left-0 top-0 bottom-0 w-1 rounded-l-xl ${queueStyle.accent}`}
                  />

                  <div className="p-3 pl-4">
                    <div className="flex items-center gap-2 mb-1.5">
                      {getStatusIcon(task.status)}
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${queueStyle.badge}`}
                      >
                        Q{task.queue_level}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.bgColor} ${statusConfig.color}`}
                      >
                        {statusConfig.label}
                      </span>
                      {task.priority >= 3 && (
                        <span className="text-red-500 dark:text-red-400 text-xs">★</span>
                      )}
                    </div>

                    <h4 className="font-medium text-slate-900 dark:text-white mb-1 truncate pr-6">
                      {task.title}
                    </h4>

                    {task.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
                        {task.description}
                      </p>
                    )}

                    {task.task_type === "long_term" &&
                      task.progress_percentage !== undefined && (
                        <div className="mb-2">
                          <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>进度</span>
                            <span>{task.progress_percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <motion.div
                              className="bg-blue-500 h-1.5 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress_percentage}%` }}
                              transition={{ duration: 0.5, delay: index * 0.05 }}
                            />
                          </div>
                        </div>
                      )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
                      {task.estimated_duration && (
                        <div className="flex items-center gap-1">
                          <Clock size={12} className={queueStyle.text} />
                          <span>{formatDuration(task.estimated_duration)}</span>
                        </div>
                      )}

                      {deadlineInfo && (
                        <div className="flex items-center gap-1">
                          <Calendar size={12} className={deadlineInfo.color} />
                          <span className={deadlineInfo.color}>{deadlineInfo.text}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {onTaskClick && (
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <ExternalLink size={16} className="text-slate-400" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default RelatedTasks;
