import React, { useState, useId, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDroppable } from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Clock,
  Plus,
  ChevronDown,
  ChevronUp,
  Zap,
  Target,
  ListTodo,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserTask } from "@shared/types";
import { TaskCard } from "./TaskCard";
import { formatDurationMinutes } from "../../utils/formatters";
import { EmptyState } from "../common/EmptyState";

interface QueueColumnProps {
  level: number;
  title: string;
  timeSlice: number;
  tasks: UserTask[];
  onTaskClick?: (task: UserTask) => void;
  onTaskMove?: (taskId: string, targetQueue: number) => void;
  onReorder?: (taskIds: string[]) => void;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onAddTask?: () => void;
}

const QUEUE_CONFIG = {
  0: {
    icon: Zap,
    gradient: "from-primary-500 to-primary-500",
    border: "border-primary-300 dark:border-primary-400/50",
    glow: "shadow-primary-500/20",
    headerBg:
      "bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-500/20 dark:to-primary-500/20",
    accentColor: "text-primary-600 dark:text-primary-400",
    badgeBg: "bg-primary-100 dark:bg-primary-500/20",
    ringColor: "ring-primary-400",
  },
  1: {
    icon: Target,
    gradient: "from-emerald-500 to-teal-500",
    border: "border-emerald-300 dark:border-emerald-400/50",
    glow: "shadow-emerald-500/20",
    headerBg:
      "bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    badgeBg: "bg-emerald-100 dark:bg-emerald-500/20",
    ringColor: "ring-emerald-400",
  },
  2: {
    icon: ListTodo,
    gradient: "from-amber-500 to-orange-500",
    border: "border-amber-300 dark:border-amber-400/50",
    glow: "shadow-amber-500/20",
    headerBg:
      "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20",
    accentColor: "text-amber-600 dark:text-amber-400",
    badgeBg: "bg-amber-100 dark:bg-amber-500/20",
    ringColor: "ring-amber-400",
  },
};

export const QueueColumn: React.FC<QueueColumnProps> = ({
  level,
  title,
  timeSlice,
  tasks,
  onTaskClick: _onTaskClick,
  onTaskMove: _onTaskMove,
  onReorder: _onReorder,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onAddTask,
}) => {
  void _onTaskClick;
  void _onTaskMove;
  void _onReorder;
  const { t } = useTranslation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const contentPanelId = useId();
  const config =
    QUEUE_CONFIG[level as keyof typeof QUEUE_CONFIG] || QUEUE_CONFIG[2];
  const IconComponent = config.icon;

  const queueDescriptions = useMemo(
    () => ({
      0: t("scheduler.queueColumn.quadrantUrgentImportant"),
      1: t("scheduler.queueColumn.quadrantImportant"),
      2: t("scheduler.queueColumn.quadrantTodo"),
    }),
    [t],
  );
  const queueDescription =
    queueDescriptions[level as keyof typeof queueDescriptions] ??
    queueDescriptions[2];

  const { setNodeRef, isOver } = useDroppable({
    id: `queue-${level}`,
    data: { queueLevel: level, type: "queue" },
  });

  // 单趟统计总时长并按状态分桶，替代 reduce + 两次 filter 的 O(3*tasks) 扫描
  let totalEstimatedTime = 0;
  const pendingTasks: UserTask[] = [];
  const inProgressTasks: UserTask[] = [];
  for (const t of tasks) {
    totalEstimatedTime += t.estimated_duration || 0;
    if (t.status === "pending") pendingTasks.push(t);
    else if (t.status === "in_progress") inProgressTasks.push(t);
  }

  const visibleTasks = [...inProgressTasks, ...pendingTasks];
  const taskIds = visibleTasks.map((t) => t.id);

  return (
    <div
      ref={setNodeRef}
      className={`
        flex flex-col rounded-2xl border transition-all duration-300
        ${config.border} ${config.glow}
        ${isOver ? `ring-2 ${config.ringColor} ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900` : ""}
        bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm
        min-w-[320px] max-w-[380px]
      `}
      style={{
        boxShadow: isOver
          ? `0 0 30px ${level === 0 ? "rgba(34, 211, 238, 0.3)" : level === 1 ? "rgba(52, 211, 153, 0.3)" : "rgba(251, 191, 36, 0.3)"}`
          : undefined,
      }}
    >
      <div
        className={`${config.headerBg} rounded-t-2xl p-4 border-b ${config.border}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg`}
            >
              <IconComponent size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">
                  {title}
                </h3>
                <span
                  className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeBg} ${config.accentColor}`}
                >
                  Q{level}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {queueDescription}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            aria-expanded={!isCollapsed}
            aria-controls={contentPanelId}
            aria-label={t("scheduler.queue.toggleCollapse", { queue: title })}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-500 dark:text-slate-400 min-h-[44px] min-w-[44px] flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800"
          >
            {isCollapsed ? <ChevronDown size={18} aria-hidden="true" /> : <ChevronUp size={18} aria-hidden="true" />}
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock size={12} className={config.accentColor} />
            <span>
              {t("scheduler.queueColumn.timeSlice")}{" "}
              <span className={config.accentColor}>
                {formatDurationMinutes(timeSlice, { format: 'compact' })}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>
              {t("scheduler.queueColumn.task")}{" "}
              <span className="text-slate-900 dark:text-white font-medium">
                {tasks.length}
              </span>
            </span>
          </div>
          {totalEstimatedTime > 0 && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>
                {t("scheduler.queueColumn.estimated")}{" "}
                <span className="text-slate-900 dark:text-white font-medium">
                  {formatDurationMinutes(totalEstimatedTime, { format: 'compact' })}
                </span>
              </span>
            </div>
          )}
        </div>

        {inProgressTasks.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
            <span className="text-xs text-primary-600 dark:text-primary-400">
              {t("scheduler.queueColumn.tasksInProgress", { count: inProgressTasks.length })}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            id={contentPanelId}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <div className="p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
              {pendingTasks.length === 0 && inProgressTasks.length === 0 ? (
                <EmptyState
                  icon={<ListTodo size={32} />}
                  title={t('scheduler.empty.queueEmpty')}
                  description={isOver ? t('scheduler.queueColumn.releaseToPlace') : undefined}
                  action={onAddTask ? { label: `+ ${t('scheduler.queueColumn.addTask')}`, onClick: onAddTask } : undefined}
                  className="min-h-[100px] py-8"
                />
              ) : (
                <SortableContext
                  items={taskIds}
                  strategy={verticalListSortingStrategy}
                >
                  <AnimatePresence>
                    {visibleTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onEditTask={onEditTask}
                        onDeleteTask={onDeleteTask}
                        onStartTask={onStartTask}
                        onPauseTask={onPauseTask}
                        onCompleteTask={onCompleteTask}
                      />
                    ))}
                  </AnimatePresence>
                </SortableContext>
              )}
            </div>

            {onAddTask && tasks.length > 0 && (
              <div className="p-3 pt-0">
                <button
                  onClick={onAddTask}
                  className={`
                    w-full py-2 rounded-xl border border-dashed
                    ${config.border} ${config.accentColor}
                    hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all
                    flex items-center justify-center gap-2 text-sm
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800
                  `}
                >
                  <Plus size={16} />
                  {t("scheduler.queueColumn.addTask")}
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isCollapsed && (
        <div className="p-3 text-center text-slate-400 dark:text-slate-500 text-sm">
          {t("scheduler.queueColumn.taskCount", { count: tasks.length })}
        </div>
      )}
    </div>
  );
};
