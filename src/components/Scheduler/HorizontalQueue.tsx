import React, { useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Droppable } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { Clock, Plus, Zap, Target, ListTodo } from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserTask } from "@shared/types";
import { DraggableTaskCard } from "./DraggableTaskCard";

interface HorizontalQueueProps {
  level: number;
  title: string;
  timeSlice: number;
  tasks: UserTask[];
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onAddTask?: () => void;
  onViewTaskDetail?: (task: UserTask) => void;
}

export const HorizontalQueue: React.FC<HorizontalQueueProps> = ({
  level,
  title,
  timeSlice,
  tasks,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onAddTask,
  onViewTaskDetail,
}) => {
  const { t } = useTranslation();
  
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
      description: t("scheduler.queue.urgentDesc"),
      arrowColor: "#06b6d4",
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
      description: t("scheduler.queue.importantDesc"),
      arrowColor: "#10b981",
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
      description: t("scheduler.queue.todoDesc"),
      arrowColor: "#f59e0b",
    },
  };

  const config =
    QUEUE_CONFIG[level as keyof typeof QUEUE_CONFIG] || QUEUE_CONFIG[2];
  const IconComponent = config.icon;
  const containerRef = useRef<HTMLDivElement>(null);
  const queueWrapperRef = useRef<HTMLDivElement>(null);

  const formatTimeSlice = (minutes: number) => {
    if (minutes < 60) return t("scheduler.minutes", { count: minutes });
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
  const pausedTasks = tasks.filter((t) => t.status === "paused");
  const visibleTasks = [...inProgressTasks, ...pausedTasks, ...pendingTasks];

  useEffect(() => {
    // 队列初始位置保持在左边，不自动滚动到右边
  }, [tasks.length]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!e.shiftKey) return;

    const container = containerRef.current;
    if (!container) return;

    const hasHorizontalOverflow = container.scrollWidth > container.clientWidth;
    if (!hasHorizontalOverflow) return;

    e.preventDefault();
    e.stopPropagation();

    const scrollAmount = e.deltaY || e.deltaX;
    container.scrollBy({
      left: scrollAmount,
      behavior: "auto",
    });
  }, []);

  return (
    <div className="flex flex-col" ref={queueWrapperRef}>
      <div
        className={`${config.headerBg} rounded-t-2xl p-3 border-b ${config.border}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-3">
            <div
              className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg`}
            >
              <IconComponent size={16} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white text-sm">
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

          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <Clock size={12} className={config.accentColor} />
              <span>
                {t("scheduler.queue.timeSlice")}:{" "}
                <span className={config.accentColor}>
                  {formatTimeSlice(timeSlice)}
                </span>
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>
                {t("scheduler.queue.tasks")}:{" "}
                <span className="text-slate-900 dark:text-white font-medium">
                  {visibleTasks.length}
                </span>
              </span>
            </div>
            {totalEstimatedTime > 0 && (
              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                <span>
                  {t("scheduler.queue.estimated")}:{" "}
                  <span className="text-slate-900 dark:text-white font-medium">
                    {formatTimeSlice(totalEstimatedTime)}
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>

        {inProgressTasks.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
            <span className="text-xs text-primary-600 dark:text-primary-400">
              {t("scheduler.queue.tasksInProgress", { count: inProgressTasks.length })}
            </span>
          </div>
        )}
      </div>

      <Droppable
        droppableId={`queue-${level}`}
        direction="horizontal"
        type="task"
        renderClone={(provided, _snapshot, rubric) => {
          const task = visibleTasks[rubric.source.index];
          if (!task) return null;

          return createPortal(
            <div
              ref={provided.innerRef}
              {...provided.draggableProps}
              {...provided.dragHandleProps}
              style={{
                ...provided.draggableProps.style,
              }}
              className="z-[9999]"
            >
              <div
                className={`
                rounded-xl border shadow-2xl ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 opacity-95
                border-primary-300 dark:border-primary-400 shadow-primary-500/30
                bg-white dark:bg-slate-900/80 backdrop-blur-sm
                overflow-hidden flex-shrink-0
              `}
                style={{ width: "180px" }}
              >
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary-500" />
                <div className="p-3 pl-4">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-primary-100 dark:bg-primary-500/20 text-primary-700 dark:text-primary-300">
                      Q{task.queue_level}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400">
                      {task.status === "pending"
                        ? t("scheduler.kanban.todo")
                        : task.status === "in_progress"
                          ? t("scheduler.inProgress")
                          : task.status}
                    </span>
                  </div>
                  <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1 truncate pr-2">
                    {task.title}
                  </h4>
                  {task.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>
            </div>,
            document.body,
          );
        }}
      >
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            onWheel={handleWheel}
            className={`
              relative min-h-[140px] p-4 transition-all duration-300
              ${
                snapshot.isDraggingOver
                  ? "bg-slate-100/50 dark:bg-slate-800/50 ring-2 ring-inset ring-primary-400/30"
                  : "bg-white/50 dark:bg-slate-900/30"
              }
              border-x ${config.border}
            `}
          >
            <div
              ref={containerRef}
              className="flex items-center gap-3 overflow-x-auto custom-scrollbar pb-2"
            >
              {visibleTasks.length === 0 ? (
                <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 min-h-[100px]">
                  <div className="text-center">
                    <IconComponent
                      size={32}
                      className="mx-auto mb-2 opacity-40 dark:opacity-30"
                    />
                    <p className="text-sm">{t("scheduler.queue.noTasks")}</p>
                    {snapshot.isDraggingOver && (
                      <p className="text-xs mt-2 text-primary-500 dark:text-primary-400">
                        {t("scheduler.queue.dropToPlace")}
                      </p>
                    )}
                    {onAddTask && (
                      <button
                        onClick={onAddTask}
                        className={`mt-3 text-sm ${config.accentColor} hover:underline`}
                      >
                        + {t("scheduler.queue.addTask")}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {visibleTasks.map((task, index) => (
                    <React.Fragment key={task.id}>
                      <DraggableTaskCard
                        task={task}
                        index={index}
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
                        onViewDetail={
                          onViewTaskDetail
                            ? () => onViewTaskDetail(task)
                            : undefined
                        }
                      />
                      {index < visibleTasks.length - 1 && (
                        <svg
                          width="24"
                          height="24"
                          viewBox="0 0 24 24"
                          className="flex-shrink-0 text-slate-300 dark:text-slate-600"
                        >
                          <path
                            d="M5 12h14M13 6l6 6-6 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                        </svg>
                      )}
                    </React.Fragment>
                  ))}

                  {onAddTask && (
                    <motion.button
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      onClick={onAddTask}
                      className={`
                          flex-shrink-0 w-[140px] sm:w-[180px] h-[90px] sm:h-[100px] rounded-xl border-2 border-dashed
                          ${config.border} ${config.accentColor}
                          hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all
                          flex flex-col items-center justify-center gap-2 text-xs sm:text-sm min-h-[44px]
                        `}
                    >
                      <Plus size={18} />
                      <span>{t("scheduler.queue.addTask")}</span>
                    </motion.button>
                  )}
                </>
              )}
              {provided.placeholder}
            </div>

            {snapshot.isDraggingOver && visibleTasks.length > 0 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="absolute inset-0 pointer-events-none border-2 border-dashed border-primary-400/50 rounded-lg bg-primary-500/5"
              />
            )}
          </div>
        )}
      </Droppable>

      <div
        className={`h-1 bg-gradient-to-r ${config.gradient} rounded-b-2xl opacity-50`}
      />
    </div>
  );
};
