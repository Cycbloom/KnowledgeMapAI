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
  ClipboardList,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { useSchedulerTasks } from "../../hooks";
import { formatDurationMinutes, formatDate } from "../../utils/formatters";
import type { UserTask, UserTaskStatus } from "@shared/types";
import { QUEUE_COLORS, STATUS_CONFIG, type QueueLevel } from "@/constants/scheduler";
import { EmptyState } from "../common/EmptyState";

interface RelatedTasksProps {
  knowledgePointId: string;
  onTaskClick?: (taskId: string) => void;
  onCreateTask?: () => void;
}

const formatDeadline = (date: string | undefined, t: TFunction): { text: string; color: string } | null => {
  if (!date) return null;
  const d = new Date(date);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  if (days < 0) return { text: t("tasks.related.deadline.expired"), color: "text-red-500 dark:text-red-400" };
  if (days === 0) return { text: t("tasks.related.deadline.today"), color: "text-amber-500 dark:text-amber-400" };
  if (days === 1) return { text: t("tasks.related.deadline.tomorrow"), color: "text-yellow-500 dark:text-yellow-400" };
  if (days <= 7) return { text: t("tasks.related.deadline.inDays", { days }), color: "text-primary-500 dark:text-primary-400" };
  return { text: formatDate(date, "short"), color: "text-slate-500 dark:text-slate-400" };
};

const getStatusIcon = (status: UserTaskStatus) => {
  switch (status) {
    case "completed":
      return <CheckCircle size={16} className="text-emerald-500" />;
    case "in_progress":
      return <Play size={16} className="text-primary-500" />;
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
  const { t } = useTranslation();

  const relatedTasks = React.useMemo(() => {
    if (!tasksData) return [];
    return tasksData.filter(
      (task: UserTask) => task.knowledge_point_id === knowledgePointId
    );
  }, [tasksData, knowledgePointId]);

  const taskStats = React.useMemo(() => {
    const total = relatedTasks.length;
    const completed = relatedTasks.filter((t: UserTask) => t.status === "completed").length;
    const inProgress = relatedTasks.filter((t: UserTask) => t.status === "in_progress").length;
    const pending = relatedTasks.filter((t: UserTask) => t.status === "pending").length;
    return { total, completed, inProgress, pending };
  }, [relatedTasks]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={24} className="animate-spin text-primary-500" />
        <span className="ml-2 text-slate-500 dark:text-slate-400">{t("tasks.related.loadingTasks")}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-slate-500 dark:text-slate-400">
        <AlertCircle size={24} className="text-red-500 mb-2" />
        <span>{t("toast.tasks.loadTasksFailed")}</span>
        <button
          onClick={() => refetch()}
          className="mt-2 text-sm text-primary-500 hover:text-primary-600"
        >
          {t("tasks.retry")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 shadow-lg shadow-primary-500/30">
            <ListTodo size={18} className="text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {t("tasks.related.title")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {t("tasks.related.taskCountSummary", { total: taskStats.total, completed: taskStats.completed })}
            </p>
          </div>
        </div>
        {onCreateTask && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCreateTask}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-primary-500 to-primary-500 text-white text-sm font-medium shadow-lg shadow-primary-500/30 hover:shadow-primary-500/50 transition-all"
          >
            <Plus size={16} />
            <span>{t("tasks.related.create")}</span>
          </motion.button>
        )}
      </div>

      {taskStats.total > 0 && (
        <div className="flex items-center gap-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-slate-400" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t("tasks.related.pendingCount", { count: taskStats.pending })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t("tasks.related.inProgressCount", { count: taskStats.inProgress })}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm text-slate-600 dark:text-slate-400">
              {t("tasks.related.completedCount", { count: taskStats.completed })}
            </span>
          </div>
          <div className="ml-auto">
            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("tasks.related.completionRate", {
                percent: taskStats.total > 0
                  ? Math.round((taskStats.completed / taskStats.total) * 100)
                  : 0,
              })}
            </div>
          </div>
        </div>
      )}

      <AnimatePresence mode="popLayout">
        {relatedTasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={32} />}
            title={t('scheduler.empty.tasks')}
            action={onCreateTask ? { label: t("tasks.related.createNewTask"), onClick: onCreateTask } : undefined}
          />
        ) : (
          <div className="space-y-2">
            {relatedTasks.map((task: UserTask, index: number) => {
              const statusConfig = STATUS_CONFIG[task.status as UserTaskStatus] || STATUS_CONFIG.pending;
              const queueStyle =
                QUEUE_COLORS[task.queue_level as QueueLevel] ||
                QUEUE_COLORS[0];
              const deadlineInfo = formatDeadline(task.deadline, t);

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
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.bgColor} ${statusConfig.textColor}`}
                      >
                        {t(statusConfig.labelKey, { defaultValue: '' })}
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
                            <span>{t("tasks.related.progress")}</span>
                            <span>{task.progress_percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                            <motion.div
                              className="bg-primary-500 h-1.5 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${task.progress_percentage}%` }}
                              transition={{ duration: 0.5, delay: index * 0.05 }}
                            />
                          </div>
                        </div>
                      )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {task.estimated_duration && (
                        <div className="flex items-center gap-1">
                          <Clock size={12} className={queueStyle.text} />
                          <span>{formatDurationMinutes(task.estimated_duration)}</span>
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
