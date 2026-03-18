import React, { useState, useMemo } from "react";
import { DragDropContext, DropResult } from "@hello-pangea/dnd";
import { motion } from "framer-motion";
import { LayoutGrid, Calendar, Columns, List, ChevronDown } from "lucide-react";
import { ScheduledTask, QueueData } from "@shared/types";
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
  onEditTask?: (task: ScheduledTask) => void;
  onDeleteTask?: (task: ScheduledTask) => void;
  onStartTask?: (task: ScheduledTask) => void;
  onPauseTask?: (task: ScheduledTask) => void;
  onCompleteTask?: (task: ScheduledTask) => void;
  onAddTask?: (queueLevel: number) => void;
  onViewTaskDetail?: (task: ScheduledTask) => void;
  currentView?: "queue" | "timeline" | "kanban" | "list";
  onViewChange?: (view: string) => void;
  children?: {
    timeline?: React.ReactNode;
    kanban?: React.ReactNode;
    list?: React.ReactNode;
  };
}

const VIEW_CONFIG = {
  queue: {
    icon: LayoutGrid,
    label: "队列",
    description: "横向队列视图",
  },
  timeline: {
    icon: Calendar,
    label: "时间轴",
    description: "按时间排列",
  },
  kanban: {
    icon: Columns,
    label: "看板",
    description: "状态看板",
  },
  list: {
    icon: List,
    label: "列表",
    description: "详细列表",
  },
};

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
  const [localQueues, setLocalQueues] = useState<QueueData | null>(null);
  const [collapsedQueues, setCollapsedQueues] = useState<Set<number>>(
    new Set(),
  );

  const displayQueues = localQueues || queues;

  const stats = useMemo(() => {
    const allTasks = [
      ...displayQueues.q0,
      ...displayQueues.q1,
      ...displayQueues.q2,
    ];
    const pending = allTasks.filter((t) => t.status === "pending").length;
    const inProgress = allTasks.filter(
      (t) => t.status === "in_progress",
    ).length;
    const completed = allTasks.filter((t) => t.status === "completed").length;
    return { total: allTasks.length, pending, inProgress, completed };
  }, [displayQueues]);

  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) {
      setLocalQueues(null);
      return;
    }

    const sourceQueueKey = source.droppableId.replace(
      "queue-",
      "q",
    ) as keyof QueueData;
    const destQueueKey = destination.droppableId.replace(
      "queue-",
      "q",
    ) as keyof QueueData;

    if (sourceQueueKey === destQueueKey && source.index === destination.index) {
      setLocalQueues(null);
      return;
    }

    const newQueues = { ...displayQueues };
    const sourceTasks = [...newQueues[sourceQueueKey]];
    const [movedTask] = sourceTasks.splice(source.index, 1);

    if (sourceQueueKey !== destQueueKey) {
      const destTasks = [...newQueues[destQueueKey]];
      const updatedTask = {
        ...movedTask,
        queue_level: parseInt(destQueueKey.replace("q", "")),
      };
      destTasks.splice(destination.index, 0, updatedTask);

      newQueues[sourceQueueKey] = sourceTasks;
      newQueues[destQueueKey] = destTasks;

      setLocalQueues(newQueues);

      if (onTaskMove) {
        const targetQueueLevel = parseInt(destQueueKey.replace("q", ""));
        onTaskMove(draggableId, targetQueueLevel);
      }
    } else {
      sourceTasks.splice(destination.index, 0, movedTask);
      newQueues[sourceQueueKey] = sourceTasks;

      setLocalQueues(newQueues);

      if (onReorder) {
        const queueLevel = parseInt(sourceQueueKey.replace("q", ""));
        const taskIds = sourceTasks.map((t) => t.id);
        onReorder(queueLevel, taskIds);
      }
    }
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

  const queueTitles = {
    0: "紧急队列",
    1: "重要队列",
    2: "待办队列",
  };

  const renderQueueView = () => (
    <DragDropContext onDragEnd={handleDragEnd}>
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
                    ? "border-cyan-300 dark:border-cyan-400/50"
                    : level === 1
                      ? "border-emerald-300 dark:border-emerald-400/50"
                      : "border-amber-300 dark:border-amber-400/50"
                }
                bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm
              `}
            >
              {isCollapsed ? (
                <div
                  className={`
                    p-4 flex items-center justify-between cursor-pointer
                    ${
                      level === 0
                        ? "bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-500/20 dark:to-blue-500/20"
                        : level === 1
                          ? "bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20"
                          : "bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20"
                    }
                    rounded-t-2xl
                  `}
                  onClick={() => toggleCollapse(level)}
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`font-bold text-slate-900 dark:text-white`}
                    >
                      {queueTitles[level as keyof typeof queueTitles]}
                    </span>
                    <span className="text-sm text-slate-500 dark:text-slate-400">
                      {displayQueues[queueKey].length} 个任务
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
    </DragDropContext>
  );

  return (
    <div className="h-full flex flex-col">
      {onViewChange && (
        <div className="flex-shrink-0 p-3 sm:p-4 border-b border-slate-200 dark:border-slate-800/50 bg-white/50 dark:bg-slate-900/30 backdrop-blur-sm">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/50 overflow-x-auto custom-scrollbar">
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
                          ? "text-white bg-gradient-to-r from-cyan-500 to-blue-500 shadow-lg shadow-cyan-500/30"
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
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400 animate-pulse" />
                <span className="text-slate-500 dark:text-slate-400">
                  待处理
                </span>
                <span className="font-bold text-cyan-600 dark:text-cyan-400">
                  {stats.pending}
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                <span className="text-slate-500 dark:text-slate-400">
                  进行中
                </span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {stats.inProgress}
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
                <div className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                <span className="text-slate-500 dark:text-slate-400">
                  已完成
                </span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                  {stats.completed}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1">
        {currentView === "queue" && <div key="queue">{renderQueueView()}</div>}

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
                时间轴视图
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
                看板视图
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
                列表视图
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};
