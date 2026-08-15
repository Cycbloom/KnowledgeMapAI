import React, { useState, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { motion } from "framer-motion";
import { LayoutGrid, Calendar, Columns, List, ChevronDown } from "lucide-react";
import { useTranslation } from 'react-i18next';
import { UserTask, QueueData } from "@shared/types";
import { HorizontalQueue } from "./HorizontalQueue";

interface HorizontalQueueViewProps {
  queues: QueueData;
  timeSlices: {
    q0: number;
    q1: number;
    q2: number;
  };
  onTaskMove?: (taskId: string, targetQueue: number) => void;
  onReorder?: (queueLevel: number, taskIds: string[]) => void;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onAddTask?: (queueLevel: number) => void;
  onViewTaskDetail?: (task: UserTask) => void;
  currentView?: "queue" | "timeline" | "kanban" | "list";
  onViewChange?: (view: string) => void;
  children?: {
    timeline?: React.ReactNode;
    kanban?: React.ReactNode;
    list?: React.ReactNode;
  };
}

export const HorizontalQueueView: React.FC<HorizontalQueueViewProps> = ({
  queues,
  timeSlices,
  onTaskMove,
  onReorder,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onAddTask,
  onViewTaskDetail,
  currentView = "queue",
  onViewChange,
  children,
}) => {
  const { t } = useTranslation();
  const [localQueues, setLocalQueues] = useState<QueueData | null>(null);
  const [collapsedQueues, setCollapsedQueues] = useState<Set<number>>(
    new Set(),
  );
  const [activeTask, setActiveTask] = useState<UserTask | null>(null);

  const VIEW_CONFIG = {
    queue: {
      icon: LayoutGrid,
      label: t('scheduler.queue.queue'),
      description: t('scheduler.queue.queueDesc'),
    },
    timeline: {
      icon: Calendar,
      label: t('scheduler.queue.timeline'),
      description: t('scheduler.queue.timelineDesc'),
    },
    kanban: {
      icon: Columns,
      label: t('scheduler.queue.kanban'),
      description: t('scheduler.queue.kanbanDesc'),
    },
    list: {
      icon: List,
      label: t('scheduler.queue.list'),
      description: t('scheduler.queue.listDesc'),
    },
  };

  const queueTitles = {
    0: t('scheduler.queue.urgent'),
    1: t('scheduler.queue.important'),
    2: t('scheduler.queue.todo'),
  };

  const displayQueues = localQueues || queues;

  const stats = useMemo(() => {
    const allTasks = [
      ...displayQueues.q0,
      ...displayQueues.q1,
      ...displayQueues.q2,
    ];
    // 单趟统计状态数量，替代三次 filter 的 O(3*tasks) 扫描
    let pending = 0;
    let inProgress = 0;
    let completed = 0;
    for (const t of allTasks) {
      if (t.status === "pending") pending++;
      else if (t.status === "in_progress") inProgress++;
      else if (t.status === "completed") completed++;
    }
    return { total: allTasks.length, pending, inProgress, completed };
  }, [displayQueues]);

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = String(event.active.id);
    const allTasks = [
      ...displayQueues.q0,
      ...displayQueues.q1,
      ...displayQueues.q2,
    ];
    const task = allTasks.find((t) => t.id === activeId);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) {
      setLocalQueues(null);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId === overId) {
      setLocalQueues(null);
      return;
    }

    const activeQueueLevel =
      (active.data.current?.queueLevel as number) ?? 0;
    const sourceQueueKey = `q${activeQueueLevel}` as keyof QueueData;

    let destQueueLevel: number;

    if (overId.startsWith("queue-")) {
      destQueueLevel = parseInt(overId.replace("queue-", ""));
      if (destQueueLevel === activeQueueLevel) {
        setLocalQueues(null);
        return;
      }
    } else {
      const overData = over.data.current;
      destQueueLevel = (overData?.queueLevel as number) ?? 0;
    }

    const destQueueKey = `q${destQueueLevel}` as keyof QueueData;

    if (sourceQueueKey === destQueueKey) {
      const sourceIndex = displayQueues[sourceQueueKey].findIndex(
        (t) => t.id === activeId,
      );
      const overIndex = displayQueues[sourceQueueKey].findIndex(
        (t) => t.id === overId,
      );

      if (sourceIndex === overIndex || sourceIndex === -1 || overIndex === -1) {
        setLocalQueues(null);
        return;
      }

      const newQueues = { ...displayQueues };
      newQueues[sourceQueueKey] = arrayMove(
        [...displayQueues[sourceQueueKey]],
        sourceIndex,
        overIndex,
      );

      setLocalQueues(newQueues);

      if (onReorder) {
        onReorder(activeQueueLevel, newQueues[sourceQueueKey].map((t) => t.id));
      }
    } else {
      const newQueues = { ...displayQueues };
      const sourceTasks = [...newQueues[sourceQueueKey]];
      const sourceIndex = sourceTasks.findIndex((t) => t.id === activeId);

      if (sourceIndex === -1) {
        setLocalQueues(null);
        return;
      }

      const [movedTask] = sourceTasks.splice(sourceIndex, 1);
      const updatedTask = { ...movedTask, queue_level: destQueueLevel };

      const destTasks = [...newQueues[destQueueKey]];
      let destIndex: number;

      if (overId.startsWith("queue-")) {
        destIndex = destTasks.length;
      } else {
        const overIndex = destTasks.findIndex((t) => t.id === overId);
        destIndex = overIndex >= 0 ? overIndex : destTasks.length;
      }

      destTasks.splice(destIndex, 0, updatedTask);

      newQueues[sourceQueueKey] = sourceTasks;
      newQueues[destQueueKey] = destTasks;

      setLocalQueues(newQueues);

      if (onTaskMove) {
        onTaskMove(activeId, destQueueLevel);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveTask(null);
    setLocalQueues(null);
  };

  const toggleCollapse = (level: number) => {
    setCollapsedQueues((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(level)) {
        newSet.delete(level);
      } else {
        newSet.add(level);
      }
      return newSet;
    });
  };

  const renderQueueView = () => (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex flex-col gap-4 p-1">
        {[0, 1, 2].map((level) => {
          const queueKey = `q${level}` as keyof QueueData;
          const isCollapsed = collapsedQueues.has(level);

          return (
            <motion.div
              key={level}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: level * 0.1 }}
              className={`
                rounded-2xl border transition-all duration-300
                ${
                  level === 0
                    ? "border-primary-300 dark:border-primary-400/50"
                    : level === 1
                      ? "border-emerald-300 dark:border-emerald-400/50"
                      : "border-amber-300 dark:border-amber-400/50"
                }
                bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm
              `}
            >
              {isCollapsed ? (
                <div
                  role="button"
                  tabIndex={0}
                  aria-expanded={false}
                  aria-label={t('scheduler.queue.toggleCollapse', { queue: queueTitles[level as keyof typeof queueTitles] })}
                  className={`
                    p-4 flex items-center justify-between cursor-pointer
                    focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400/60 dark:focus-visible:ring-primary-500/60
                    ${
                      level === 0
                        ? "bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-500/20 dark:to-primary-500/20"
                        : level === 1
                          ? "bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20"
                          : "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20"
                    }
                    rounded-t-2xl
                  `}
                  onClick={() => toggleCollapse(level)}
                  onKeyDown={(e) => {
                    if (e.key === " " || e.key === "Enter") {
                      e.preventDefault();
                      toggleCollapse(level);
                    }
                  }}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold text-slate-900 dark:text-white`}
                    >
                      {queueTitles[level as keyof typeof queueTitles]}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {t('scheduler.queue.taskCount', { count: displayQueues[queueKey].length })}
                    </span>
                  </div>
                  <ChevronDown
                    size={18}
                    className="text-slate-500 dark:text-slate-400"
                  />
                </div>
              ) : (
                <HorizontalQueue
                  level={level}
                  title={queueTitles[level as keyof typeof queueTitles]}
                  timeSlice={timeSlices[queueKey]}
                  tasks={displayQueues[queueKey]}
                  onEditTask={onEditTask}
                  onDeleteTask={onDeleteTask}
                  onStartTask={onStartTask}
                  onPauseTask={onPauseTask}
                  onCompleteTask={onCompleteTask}
                  onAddTask={onAddTask ? () => onAddTask(level) : undefined}
                  onViewTaskDetail={onViewTaskDetail}
                />
              )}
            </motion.div>
          );
        })}
      </div>
      <DragOverlay dropAnimation={null}>
        {activeTask ? (
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
                  Q{activeTask.queue_level}
                </span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400">
                  {activeTask.status === "pending"
                    ? t("scheduler.kanban.todo")
                    : activeTask.status === "in_progress"
                      ? t("scheduler.inProgress")
                      : activeTask.status}
                </span>
              </div>
              <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1 truncate pr-2">
                {activeTask.title}
              </h4>
              {activeTask.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                  {activeTask.description}
                </p>
              )}
            </div>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );

  return (
    <div className="h-full flex flex-col">
      {onViewChange && (
        <div className="flex-shrink-0 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500/50 overflow-x-auto custom-scrollbar">
              {(
                Object.keys(VIEW_CONFIG) as Array<keyof typeof VIEW_CONFIG>
              ).map((viewKey) => {
                const config = VIEW_CONFIG[viewKey];
                const IconComponent = config.icon;
                const isActive = currentView === viewKey;

                return (
                  <motion.button
                    key={viewKey}
                    onClick={() => onViewChange(viewKey)}
                    className={`
                      relative flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 rounded-lg
                      transition-all duration-300 whitespace-nowrap min-h-[44px]
                      ${
                        isActive
                          ? "text-white bg-gradient-to-r from-primary-500 to-primary-500 shadow-lg shadow-primary-500/30"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                      }
                    `}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <IconComponent size={16} />
                    <span className="text-xs sm:text-sm font-medium">{config.label}</span>
                  </motion.button>
                );
              })}
            </div>

            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
                <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
                <span className="text-slate-500 dark:text-slate-400">
                  {t('scheduler.queue.pending')}
                </span>
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {stats.pending}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
                <div className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
                <span className="text-slate-500 dark:text-slate-400">
                  {t('scheduler.queue.inProgress')}
                </span>
                <span className="font-bold text-primary-600 dark:text-primary-400">
                  {stats.inProgress}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-500">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  {t('scheduler.queue.completed')}
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-hidden">
        {currentView === "queue" && <div key="queue" data-scrollable-queue role="button" aria-label={t('scheduler.queue.region')} tabIndex={0} className="h-full overflow-y-auto custom-scrollbar">{renderQueueView()}</div>}

        {currentView === "timeline" && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            {children?.timeline || (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                {t('scheduler.queue.timelineView')}
              </div>
            )}
          </motion.div>
        )}

        {currentView === "kanban" && (
          <motion.div
            key="kanban"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            {children?.kanban || (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                {t('scheduler.queue.kanbanView')}
              </div>
            )}
          </motion.div>
        )}

        {currentView === "list" && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="h-full"
          >
            {children?.list || (
              <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                {t('scheduler.queue.listView')}
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
