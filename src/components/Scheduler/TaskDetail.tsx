import React, { useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Clock,
  Calendar,
  Tag,
  Play,
  Pause,
  Check,
  Edit2,
  Trash2,
  History,
  Link,
  Star,
  Timer,
  TrendingUp,
  ListChecks,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserTask, TaskExecution } from "@shared/types";
import { formatDurationMinutes, formatDate } from "../../utils/formatters";
import { asyncConfirm } from "../../utils/asyncConfirm";
import { EmptyState } from "../common/EmptyState";
import { TASK_DETAIL_QUEUE_CONFIG, TASK_DETAIL_STATUS_CONFIG } from "@/constants/scheduler";

interface TaskDetailProps {
  task: UserTask;
  executions: TaskExecution[];
  onEdit?: () => void;
  onDelete?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
  onClose: () => void;
}

export const TaskDetail: React.FC<TaskDetailProps> = ({
  task,
  executions,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onComplete,
  onClose,
}) => {
  const queueConfig =
    TASK_DETAIL_QUEUE_CONFIG[task.queue_level as keyof typeof TASK_DETAIL_QUEUE_CONFIG] ||
    TASK_DETAIL_QUEUE_CONFIG[2];
  const statusConfig = TASK_DETAIL_STATUS_CONFIG[task.status as keyof typeof TASK_DETAIL_STATUS_CONFIG] || TASK_DETAIL_STATUS_CONFIG.pending;
  const { t } = useTranslation();

  const executionStatusConfig = useMemo(
    () => ({
      completed: {
        label: t("scheduler.taskDetail.statusCompleted"),
        color: "text-emerald-400",
        bg: "bg-emerald-500/10",
      },
      interrupted: {
        label: t("scheduler.taskDetail.statusInterrupted"),
        color: "text-amber-400",
        bg: "bg-amber-500/10",
      },
      time_slice_ended: {
        label: t("scheduler.taskDetail.statusTimeSliceEnd"),
        color: "text-primary-400",
        bg: "bg-primary-500/10",
      },
    }),
    [t],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const formatDateTime = (dateStr?: string) => formatDate(dateStr, 'short-datetime');

  const formatExecutionDuration = (seconds?: number) => {
    if (!seconds) return "--";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return mins > 0
      ? t("scheduler.taskDetail.durationFormat", { mins, secs })
      : t("scheduler.taskDetail.durationSecondsFormat", { secs });
  };

  const totalExecutionTime = executions.reduce(
    (sum, e) => sum + (e.duration || 0),
    0,
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-2xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        >
          <div className={`p-4 border-b border-slate-700 ${queueConfig.bg}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold ${queueConfig.bg} ${queueConfig.color} border ${queueConfig.border}`}
                  >
                    {t(queueConfig.labelKey, { defaultValue: '' })}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium ${statusConfig.bg} ${statusConfig.color}`}
                  >
                    {t(statusConfig.labelKey, { defaultValue: '' })}
                  </span>
                  {task.priority >= 3 && (
                    <span className="flex items-center gap-1 text-red-400 text-xs">
                      <Star size={12} fill="currentColor" />
                      {t("scheduler.taskDetail.highPriority")}
                    </span>
                  )}
                </div>
                <h2 className="text-xl font-bold text-white">{task.title}</h2>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-lg hover:bg-slate-700/50 text-slate-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {task.description && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <p className="text-slate-300 whitespace-pre-wrap">
                  {task.description}
                </p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Clock size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.estimatedDuration")}</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {formatDurationMinutes(task.estimated_duration, { format: 'zh-spaced' })}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Timer size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.actualDuration")}</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {formatDurationMinutes(task.actual_duration, { format: 'zh-spaced' })}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Calendar size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.deadline")}</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {task.deadline ? formatDateTime(task.deadline) : t("scheduler.taskDetail.notSet")}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <TrendingUp size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.totalExecutionTime")}</span>
                </div>
                <p className="text-lg font-semibold text-white">
                  {formatExecutionDuration(totalExecutionTime)}
                </p>
              </div>
            </div>

            {task.tags && task.tags.length > 0 && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Tag size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.tags")}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {task.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 rounded-lg bg-primary-500/20 text-primary-300 text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {task.knowledge_point_id && (
              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Link size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.relatedKnowledgePoints")}</span>
                </div>
                <p className="text-white">{task.knowledge_point_id}</p>
              </div>
            )}

            <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700">
              <div className="flex items-center gap-2 text-slate-400 mb-3">
                  <History size={16} />
                  <span className="text-sm">{t("scheduler.taskDetail.executionHistory")}</span>
                  <span className="text-xs text-slate-500">
                    {t("scheduler.taskDetail.executionCountFormat", { count: executions.length })}
                  </span>
                </div>

              {executions.length === 0 ? (
                <EmptyState icon={<ListChecks size={32} />} title={t('scheduler.empty.executionRecords')} />
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {executions.map((execution, index) => {
                    const execStatus =
                      executionStatusConfig[execution.status as keyof typeof executionStatusConfig] ||
                      executionStatusConfig.completed;
                    return (
                      <div
                        key={execution.id}
                        className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">
                            #{index + 1}
                          </span>
                          <span className="text-sm text-white">
                            {formatDateTime(execution.started_at)}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded text-xs ${execStatus.bg} ${execStatus.color}`}
                          >
                            {execStatus.label}
                          </span>
                        </div>
                        <span className="text-sm text-slate-400">
                          {formatExecutionDuration(execution.duration)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="text-xs text-slate-500 flex items-center gap-4">
              <span>{t("scheduler.taskDetail.createdAt")} {formatDateTime(task.created_at)}</span>
              <span>{t("scheduler.taskDetail.updatedAt")} {formatDateTime(task.updated_at)}</span>
              {task.completed_at && (
                <span>{t("scheduler.taskDetail.completedAt")} {formatDateTime(task.completed_at)}</span>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-700 bg-slate-800/30 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {onDelete && (
                <button
                  onClick={async () => {
                    if (!await asyncConfirm({ title: t('scheduler.confirmDeleteTaskTitle'), message: t('scheduler.confirmDeleteTaskMessage'), isDangerous: true })) return;
                    onDelete();
                  }}
                  className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                  title={t('common.aria.delete')}
                  aria-label={t('common.aria.delete')}
                >
                  <Trash2 size={18} />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={onEdit}
                  className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors"
                  title={t('common.aria.edit')}
                  aria-label={t('common.aria.edit')}
                >
                  <Edit2 size={18} />
                </button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {task.status === "pending" && onStart && (
                <button
                  onClick={onStart}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500/20 text-primary-400 hover:bg-primary-500/30 transition-colors"
                >
                  <Play size={16} />
                  {t("scheduler.taskDetail.start")}
                </button>
              )}

              {task.status === "in_progress" && onPause && (
                <button
                  onClick={onPause}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
                >
                  <Pause size={16} />
                  {t("scheduler.taskDetail.pause")}
                </button>
              )}

              {(task.status === "pending" ||
                task.status === "in_progress" ||
                task.status === "paused") &&
                onComplete && (
                  <button
                    onClick={onComplete}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                  >
                    <Check size={16} />
                  {t("scheduler.taskDetail.complete")}
                </button>
                )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
