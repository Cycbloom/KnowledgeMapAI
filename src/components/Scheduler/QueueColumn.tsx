import React, { useState } from "react";
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
import { UserTask } from "@shared/types";
import { TaskCard } from "./TaskCard";

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
    description: "紧急重要任务",
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
    description: "重要任务",
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
    description: "待办任务",
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
  const [isCollapsed, setIsCollapsed] = useState(false);
  const config =
    QUEUE_CONFIG[level as keyof typeof QUEUE_CONFIG] || QUEUE_CONFIG[2];
  const IconComponent = config.icon;

  const { setNodeRef, isOver } = useDroppable({
    id: `queue-${level}`,
    data: { queueLevel: level, type: "queue" },
  });

  const formatTimeSlice = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const totalEstimatedTime = tasks.reduce(
    (sum, t) => sum + (t.estimated_duration || 0),
    0,
  );
  const pendingTasks = tasks.filter((t) => t.status === "pending");
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress");

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
                {config.description}
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-slate-500 dark:text-slate-400"
          >
            {isCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
          </button>
        </div>

        <div className="flex items-center gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <Clock size={12} className={config.accentColor} />
            <span>
              时间片:{" "}
              <span className={config.accentColor}>
                {formatTimeSlice(timeSlice)}
              </span>
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>
              任务:{" "}
              <span className="text-slate-900 dark:text-white font-medium">
                {tasks.length}
              </span>
            </span>
          </div>
          {totalEstimatedTime > 0 && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>
                预计:{" "}
                <span className="text-slate-900 dark:text-white font-medium">
                  {formatTimeSlice(totalEstimatedTime)}
                </span>
              </span>
            </div>
          )}
        </div>

        {inProgressTasks.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
            <span className="text-xs text-primary-600 dark:text-primary-400">
              {inProgressTasks.length} 个任务进行中
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <div className="p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
              {pendingTasks.length === 0 && inProgressTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500 min-h-[100px]">
                  <IconComponent
                    size={32}
                    className="mx-auto mb-2 opacity-40 dark:opacity-30"
                  />
                  <p className="text-sm">暂无任务</p>
                  {isOver && (
                    <p className="text-xs mt-2 text-primary-500 dark:text-primary-400">
                      释放以放置任务
                    </p>
                  )}
                  {onAddTask && (
                    <button
                      onClick={onAddTask}
                      className={`mt-3 text-sm ${config.accentColor} hover:underline`}
                    >
                      + 添加任务
                    </button>
                  )}
                </div>
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
                        onEdit={onEditTask ? () => onEditTask(task) : undefined}
                        onDelete={
                          onDeleteTask ? () => onDeleteTask(task) : undefined
                        }
                        onStart={
                          onStartTask ? () => onStartTask(task) : undefined
                        }
                        onPause={
                          onPauseTask ? () => onPauseTask(task) : undefined
                        }
                        onComplete={
                          onCompleteTask
                            ? () => onCompleteTask(task)
                            : undefined
                        }
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
                  `}
                >
                  <Plus size={16} />
                  添加任务
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {isCollapsed && (
        <div className="p-3 text-center text-slate-400 dark:text-slate-500 text-sm">
          {tasks.length} 个任务
        </div>
      )}
    </div>
  );
};
