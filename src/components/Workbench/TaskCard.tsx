import React from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  Clock,
  Zap,
  AlertCircle,
  Link2,
  CheckCircle2,
  Calendar,
  Target,
} from "lucide-react";
import type { UserTask } from "@shared/types";
import { QUEUE_COLORS, STATUS_CONFIG, type QueueLevel } from "@/constants/scheduler";

interface DeadlineInfo {
  text: string;
  color: string;
}

interface TaskCardProps {
  task: UserTask;
  queueLevel: number;
  getStatusLabel: (status: string) => string;
  formatDuration: (minutes: number) => string;
  formatDeadline: (date?: string) => DeadlineInfo | null;
  onStartTask: (task: UserTask) => void;
  onPauseTask: (task: UserTask) => void;
  onCompleteTask: (task: UserTask) => void;
  onEditTask: (task: UserTask) => void;
  onDeleteTask: (task: UserTask) => void;
  onLinkKnowledgePoint: (taskId: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  queueLevel,
  getStatusLabel,
  formatDuration,
  formatDeadline,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onEditTask,
  onDeleteTask,
  onLinkKnowledgePoint,
}) => {
  const { t } = useTranslation();
  const queueStyle = QUEUE_COLORS[queueLevel as QueueLevel] || QUEUE_COLORS[0];
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const deadlineInfo = formatDeadline(task.deadline);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`
        group relative rounded-xl border transition-all duration-200
        ${queueStyle.border} hover:shadow-lg
        bg-white dark:bg-slate-900/80 backdrop-blur-sm
        overflow-hidden
      `}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${queueStyle.accent}`} />

      <div className="p-3 pl-4">
        <div className="flex items-center gap-2 mb-1.5">
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${queueStyle.badge}`}>
            Q{task.queue_level}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.color}`}>
            {getStatusLabel(task.status)}
          </span>
          {task.priority >= 3 && (
            <span className="text-red-500 dark:text-red-400 text-xs">★</span>
          )}
        </div>

        <h4 className="font-medium text-slate-900 dark:text-white mb-1 truncate pr-2">
          {task.title}
        </h4>

        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">
            {task.description}
          </p>
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

        <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
          {task.status === "pending" && (
            <button
              onClick={() => onStartTask(task)}
              className={`p-1.5 rounded-md transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
              aria-label={t("common.aria.startTask")}
            >
              <Zap size={14} />
            </button>
          )}

          {task.status === "in_progress" && (
            <button
              onClick={() => onPauseTask(task)}
              className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all hover:scale-110"
              aria-label={t("common.aria.pauseTask")}
            >
              <Clock size={14} />
            </button>
          )}

          {(task.status === "pending" || task.status === "in_progress" || task.status === "paused") && (
            <button
              onClick={() => onCompleteTask(task)}
              className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-110"
              aria-label={t("common.aria.completeTask")}
            >
              <CheckCircle2 size={14} />
            </button>
          )}

          <button
            onClick={() => onEditTask(task)}
            className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all hover:scale-110"
            aria-label={t("common.aria.editTask")}
          >
            <Target size={14} />
          </button>

          <button
            onClick={() => onLinkKnowledgePoint(task.id)}
            className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:scale-110"
            aria-label={t("common.aria.linkKnowledgePoint")}
          >
            <Link2 size={14} />
          </button>

          <button
            onClick={() => onDeleteTask(task)}
            className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110"
            aria-label={t("common.aria.deleteTask")}
          >
            <AlertCircle size={14} />
          </button>
        </div>
      </div>

      {task.status === "in_progress" && (
        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${queueStyle.bg} overflow-hidden`}>
          <motion.div
            className={`h-full ${queueStyle.accent}`}
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>
      )}
    </motion.div>
  );
};
