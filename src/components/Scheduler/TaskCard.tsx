import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  Calendar,
  Tag,
  Play,
  Pause,
  Check,
  Edit2,
  Trash2,
  AlertCircle,
  Repeat,
  Info,
  ChevronDown,
  ChevronRight,
  BookOpen,
  Circle,
  CheckCircle,
} from "lucide-react";
import { UserTask, TaskSubtask } from "@shared/types";
import { QUEUE_COLORS, STATUS_CONFIG, type QueueLevel } from "@/constants/scheduler";
import { api } from "../../services/api";
import { message } from "../../utils/messageHelper";
import { formatDurationMinutes, formatDate } from "../../utils/formatters";
import { frontendEventBus } from "../../services/timer/FrontendEventBus";

interface TaskCardProps {
  task: UserTask;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onViewTaskDetail?: (task: UserTask) => void;
  onSubtaskUpdate?: () => void;
}

const getTaskTypeBadge = (taskType: string | undefined, t: (key: string) => string) => {
  if (!taskType || taskType === "one_time") return null;

  const badges: Record<string, { label: string; icon?: React.ComponentType<{ size?: number | string }>; color: string }> = {
    long_term: {
      label: t("scheduler.taskCard.typeLongTerm"),
      color:
        "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300",
    },
    periodic: {
      label: t("scheduler.taskCard.typePeriodic"),
      color:
        "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300",
    },
    learning: {
      label: t("scheduler.taskCard.typeLearning"),
      icon: BookOpen,
      color:
        "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    },
  };

  const badge = badges[taskType];
  if (!badge) return null;

  const Icon = badge.icon;

  return (
    <span className={`px-1.5 py-0.5 rounded text-xs flex items-center gap-1 ${badge.color}`}>
      {Icon && <Icon size={10} />}
      {badge.label}
    </span>
  );
};

const parseLearningPathContext = (context?: Record<string, unknown> | string): { pathId?: string; pathTitle?: string } => {
  if (!context) return {};
  if (typeof context === 'object') {
    if (context.type === "learning_path") {
      return { pathId: context.path_id as string | undefined, pathTitle: context.path_title as string | undefined };
    }
    return {};
  }
  try {
    const parsed = JSON.parse(context);
    if (parsed.type === "learning_path") {
      return { pathId: parsed.path_id, pathTitle: parsed.path_title };
    }
  } catch {
    // ignore
  }
  return {};
};

const TaskCardInner: React.FC<TaskCardProps> = ({
  task,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onViewTaskDetail,
  onSubtaskUpdate,
}) => {
  const { t } = useTranslation();
  const [showSubtasks, setShowSubtasks] = useState(false);
  const [subtasks, setSubtasks] = useState<TaskSubtask[]>([]);
  const [loadingSubtasks, setLoadingSubtasks] = useState(false);

  const queueStyle =
    QUEUE_COLORS[task.queue_level as QueueLevel] ||
    QUEUE_COLORS[0];
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      taskId: task.id,
      queueLevel: task.queue_level,
      type: "task",
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatDeadline = (date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

    if (days < 0)
      return { text: t("scheduler.taskCard.overdue"), color: "text-red-500 dark:text-red-400" };
    if (days === 0)
      return { text: t("scheduler.taskCard.today"), color: "text-amber-500 dark:text-amber-400" };
    if (days === 1)
      return { text: t("scheduler.taskCard.tomorrow"), color: "text-yellow-500 dark:text-yellow-400" };
    if (days <= 7)
      return { text: t("scheduler.taskCard.daysLater", { count: days }), color: "text-primary-500 dark:text-primary-400" };
    return {
      text: formatDate(d, 'short'),
      color: "text-slate-500 dark:text-slate-400",
    };
  };

  const deadlineInfo = formatDeadline(task.deadline);
  const learningPathInfo = parseLearningPathContext(task.context);

  const hasActions =
    (task.status === "pending" && onStartTask) ||
    (task.status === "in_progress" && onPauseTask) ||
    ((task.status === "pending" ||
      task.status === "in_progress" ||
      task.status === "paused") &&
      onCompleteTask) ||
    onEditTask ||
    onDeleteTask;

  const hasSubtasks = task.has_subtasks || (task.subtask_count && task.subtask_count > 0);
  const subtaskProgress = hasSubtasks && task.subtask_count
    ? Math.round(((task.subtask_completed || 0) / task.subtask_count) * 100)
    : 0;

  const loadSubtasks = async () => {
    if (!hasSubtasks || subtasks.length > 0) return;
    setLoadingSubtasks(true);
    try {
      const response = await api.scheduler.getSubtasks(task.id);
      if (response.success) {
        setSubtasks(response.data || []);
      }
    } catch (error) {
      console.error("Failed to load subtasks:", error);
    } finally {
      setLoadingSubtasks(false);
    }
  };

  useEffect(() => {
    if (showSubtasks && hasSubtasks) {
      loadSubtasks();
    }
  }, [showSubtasks, hasSubtasks]);

  const handleToggleSubtask = async (subtask: TaskSubtask) => {
    const newStatus = subtask.status === "completed" ? "pending" : "completed";
    try {
      const response = await api.scheduler.updateSubtask(task.id, subtask.id, {
        status: newStatus,
      });
      if (response.success) {
        setSubtasks(
          subtasks.map((st) => (st.id === subtask.id ? response.data : st))
        );
        onSubtaskUpdate?.();
        message.success(newStatus === "completed" ? t("scheduler.taskCard.subtaskCompleted") : t("scheduler.taskCard.subtaskReopened"));
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : t("scheduler.taskCard.updateSubtaskFailed");
      frontendEventBus.publish("message_show", { type: "error", content: errorMessage });
    }
  };

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{
        opacity: isDragging ? 0.9 : 1,
        y: 0,
        scale: isDragging ? 1.02 : 1,
      }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? "shadow-2xl z-50 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : "hover:shadow-lg"}
        ${queueStyle.border} ${isDragging ? queueStyle.glow : ""}
        bg-white dark:bg-slate-900/80 backdrop-blur-sm
        overflow-hidden
      `}
    >
      {isDragging && (
        <div
          className={`
            absolute inset-0 rounded-xl border-2 border-dashed 
            ${queueStyle.border} ${queueStyle.bg}
            animate-pulse pointer-events-none
          `}
          style={{ zIndex: -1 }}
        />
      )}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${queueStyle.accent}`}
      />

      <div className="p-2 pl-3">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${queueStyle.badge}`}
          >
            Q{task.queue_level}
          </span>
          <span
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.color}`}
          >
            {statusConfig.label}
          </span>
          {task.priority >= 3 && (
            <span className="text-red-500 dark:text-red-400 text-xs">★</span>
          )}
        </div>

        <h4 className="font-medium text-slate-900 dark:text-white mb-0.5 truncate pr-2 flex items-center gap-2">
          {task.title}
          {getTaskTypeBadge(task.task_type, t)}
        </h4>

        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-1.5">
            {task.description}
          </p>
        )}

        {learningPathInfo.pathTitle && (
          <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 mb-2">
            <BookOpen size={12} />
            <span className="truncate">{learningPathInfo.pathTitle}</span>
          </div>
        )}

        {task.task_type === "long_term" &&
          task.progress_percentage !== undefined && (
            <div className="mt-2 mb-2">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{t("scheduler.taskCard.progress")}</span>
                <span>{task.progress_percentage}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5">
                <div
                  className="bg-primary-500 h-1.5 rounded-full transition-all"
                  style={{ width: `${task.progress_percentage}%` }}
                />
              </div>
            </div>
          )}

        {hasSubtasks && (
          <div className="mt-1.5 mb-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowSubtasks(!showSubtasks);
              }}
              className="flex items-center justify-between w-full text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors py-1.5"
            >
              <div className="flex items-center gap-2">
                {showSubtasks ? (
                  <ChevronDown size={14} />
                ) : (
                  <ChevronRight size={14} />
                )}
                <span>{t("scheduler.taskCard.subtasks")}</span>
                <span className="text-slate-500 dark:text-slate-500">
                  {t("scheduler.taskCard.subtaskProgress", { completed: task.subtask_completed || 0, total: task.subtask_count })}
                </span>
              </div>
              <div className="flex items-center gap-2 flex-1 ml-3">
                <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-primary-500 to-primary-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${subtaskProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <span className="text-[10px] text-slate-400">{subtaskProgress}%</span>
              </div>
            </button>

            <AnimatePresence>
              {showSubtasks && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="mt-2 space-y-1 max-h-48 overflow-y-auto">
                    {loadingSubtasks ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-500" />
                      </div>
                    ) : subtasks.length > 0 ? (
                      subtasks.slice(0, 5).map((subtask) => (
                        <div
                          key={subtask.id}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-xs transition-colors ${
                            subtask.status === "completed"
                              ? "bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400"
                              : "bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleSubtask(subtask);
                            }}
                            className="flex-shrink-0 hover:scale-110 transition-transform p-1 flex items-center justify-center"
                          >
                            {subtask.status === "completed" ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Circle className="w-4 h-4 text-slate-300 dark:text-slate-600 hover:text-primary-500" />
                            )}
                          </button>
                          <span
                            className={`flex-1 truncate ${
                              subtask.status === "completed" ? "line-through" : ""
                            }`}
                          >
                            {subtask.title}
                          </span>
                          {subtask.estimated_duration && (
                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                              <Clock size={10} />
                              {t("scheduler.minutes", { count: subtask.estimated_duration })}
                            </span>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-2 text-slate-400 text-xs">
                        {t("scheduler.taskCard.noSubtasks")}
                      </div>
                    )}
                    {subtasks.length > 5 && (
                      <div className="text-center py-1 text-slate-400 text-xs">
                        {t("scheduler.taskCard.moreSubtasks", { count: subtasks.length - 5 })}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
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

          {task.tags && task.tags.length > 0 && (
            <div className="flex items-center gap-1">
              <Tag size={12} className="text-primary-500 dark:text-primary-400" />
              <span className="text-primary-500 dark:text-primary-400">
                {task.tags.slice(0, 2).join(", ")}
                {task.tags.length > 2 ? "..." : ""}
              </span>
            </div>
          )}
        </div>

        {task.dependencies && task.dependencies.length > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
            <AlertCircle className="w-3 h-3" />
            <span>
              {task.dependencies.filter(
                (d) => d.depends_on_task?.status !== "completed",
              ).length > 0
                ? t("scheduler.taskCard.pendingDependencies", { count: task.dependencies.filter((d) => d.depends_on_task?.status !== "completed").length })
                : t("scheduler.taskCard.allDependenciesCompleted")}
            </span>
          </div>
        )}

        {task.task_type === "periodic" && task.parent_task_id && (
          <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
            <Repeat className="w-3 h-3" />
            <span>{t("scheduler.taskCard.periodicInstance")}</span>
          </div>
        )}
      </div>

      {hasActions && (
        <div
          className={`
              absolute bottom-0 left-0 right-0
              flex items-center justify-end gap-1 px-2 py-1.5
              bg-gradient-to-t from-white/95 dark:from-slate-900/95 to-transparent
              backdrop-blur-sm
              opacity-0 group-hover:opacity-100
              transition-opacity duration-200
              pointer-events-auto
            `}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {task.status === "pending" && onStartTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartTask(task);
              }}
              className={`p-2.5 rounded-md transition-all hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center ${queueStyle.bg} ${queueStyle.text}`}
              title={t("scheduler.taskCard.actionStart")}
            >
              <Play size={14} />
            </button>
          )}

          {task.status === "in_progress" && onPauseTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPauseTask(task);
              }}
              className="p-2.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t("scheduler.taskCard.actionPause")}
            >
              <Pause size={14} />
            </button>
          )}

          {(task.status === "pending" ||
            task.status === "in_progress" ||
            task.status === "paused") &&
            onCompleteTask && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onCompleteTask(task);
                }}
                className="p-2.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
                title={t("scheduler.taskCard.actionComplete")}
              >
                <Check size={14} />
              </button>
            )}

          {onViewTaskDetail && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewTaskDetail(task);
              }}
              className="p-2.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t("scheduler.taskCard.actionDetail")}
            >
              <Info size={14} />
            </button>
          )}

          {onEditTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="p-2.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t("scheduler.taskCard.actionEdit")}
            >
              <Edit2 size={14} />
            </button>
          )}

          {onDeleteTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task);
              }}
              className="p-2.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110 min-h-[44px] min-w-[44px] flex items-center justify-center"
              title={t("scheduler.taskCard.actionDelete")}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      )}

      {task.status === "in_progress" && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${queueStyle.bg} overflow-hidden`}
        >
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

const areEqual = (prev: TaskCardProps, next: TaskCardProps) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.task.updated_at === next.task.updated_at
  );
};

export const TaskCard = React.memo(TaskCardInner, areEqual);
