import React, { useState, useMemo } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import {
  Circle,
  PlayCircle,
  CheckCircle2,
  XCircle,
  PauseCircle,
  Clock,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { UserTask } from "@shared/types";
import { TaskCard } from "./TaskCard";

export const KanbanView: React.FC<{
  tasks: UserTask[];
  onTaskMove?: (taskId: string, status: string) => void;
  onTaskClick?: (task: UserTask) => void;
}> = ({ tasks, onTaskMove, onTaskClick }) => {
  const { t } = useTranslation();

  const KANBAN_COLUMNS = useMemo(
    () => [
      {
        id: "pending",
        title: t("scheduler.kanban.todo"),
        icon: Circle,
        color: "slate",
        gradient:
          "from-slate-400 to-slate-500 dark:from-slate-500 dark:to-slate-600",
        border: "border-slate-300 dark:border-slate-500/30",
        bg: "bg-slate-100 dark:bg-slate-500/10",
        text: "text-slate-600 dark:text-slate-400",
      },
      {
        id: "in_progress",
        title: t("scheduler.kanban.inProgress"),
        icon: PlayCircle,
        color: "blue",
        gradient:
          "from-primary-400 to-primary-400 dark:from-primary-500 dark:to-primary-500",
        border: "border-primary-300 dark:border-primary-500/30",
        bg: "bg-primary-100 dark:bg-primary-500/10",
        text: "text-primary-600 dark:text-primary-400",
      },
      {
        id: "paused",
        title: t("scheduler.kanban.paused"),
        icon: PauseCircle,
        color: "amber",
        gradient:
          "from-amber-400 to-orange-400 dark:from-amber-500 dark:to-orange-500",
        border: "border-amber-300 dark:border-amber-500/30",
        bg: "bg-amber-100 dark:bg-amber-500/10",
        text: "text-amber-600 dark:text-amber-400",
      },
      {
        id: "completed",
        title: t("scheduler.kanban.completed"),
        icon: CheckCircle2,
        color: "emerald",
        gradient:
          "from-emerald-400 to-teal-400 dark:from-emerald-500 dark:to-teal-500",
        border: "border-emerald-300 dark:border-emerald-500/30",
        bg: "bg-emerald-100 dark:bg-emerald-500/10",
        text: "text-emerald-600 dark:text-emerald-400",
      },
      {
        id: "cancelled",
        title: t("scheduler.kanban.cancelled"),
        icon: XCircle,
        color: "red",
        gradient: "from-red-400 to-rose-400 dark:from-red-500 dark:to-rose-500",
        border: "border-red-300 dark:border-red-500/30",
        bg: "bg-red-100 dark:bg-red-500/10",
        text: "text-red-600 dark:text-red-400",
      },
    ],
    [t],
  );

  const [draggedOverColumn, setDraggedOverColumn] = useState<string | null>(
    null,
  );
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const columnsData = useMemo(() => {
    return KANBAN_COLUMNS.map((column) => ({
      ...column,
      tasks: tasks.filter((task) => task.status === column.id),
    }));
  }, [tasks, KANBAN_COLUMNS]);

  const handleDragStart = (
    e: React.DragEvent,
    taskId: string,
    currentStatus: string,
  ) => {
    e.dataTransfer.setData("taskId", taskId);
    e.dataTransfer.setData("currentStatus", currentStatus);
    setDraggedTask(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDraggedOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    setDraggedOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDraggedOverColumn(null);
  };

  const handleDrop = (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData("taskId");
    const currentStatus = e.dataTransfer.getData("currentStatus");

    if (taskId && currentStatus !== targetStatus && onTaskMove) {
      onTaskMove(taskId, targetStatus);
    }

    setDraggedTask(null);
    setDraggedOverColumn(null);
  };

  const totalEstimatedTime = (columnTasks: UserTask[]) => {
    return columnTasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
  };

  // 保留本地实现：compact 格式在 mins === 0 时省略 "0m"（返回 "Xh" 而非 "Xh 0m"），与 @/utils/formatters 的 compact 格式行为不一致
  const formatDuration = (minutes: number) => {
    if (minutes === 0) return "0h";
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="h-full min-h-0 overflow-x-auto custom-scrollbar">
      <div className="flex gap-3 sm:gap-4 min-w-max h-full p-1">
        <AnimatePresence>
          {columnsData.map((column, index) => {
            const IconComponent = column.icon;
            const isOver = draggedOverColumn === column.id;
            const estimatedTime = totalEstimatedTime(column.tasks);

            return (
              <motion.div
                key={column.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className={`
                  flex flex-col w-64 sm:w-80 flex-shrink-0 rounded-2xl border transition-all duration-300
                  ${isOver ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 scale-[1.02]" : ""}
                  ${column.border}
                  bg-white dark:bg-slate-900/60 backdrop-blur-sm
                `}
                style={{
                  boxShadow: isOver
                    ? `0 0 30px ${
                        column.color === "blue"
                          ? "rgba(59, 130, 246, 0.3)"
                          : column.color === "emerald"
                            ? "rgba(16, 185, 129, 0.3)"
                            : column.color === "amber"
                              ? "rgba(245, 158, 11, 0.3)"
                              : column.color === "red"
                                ? "rgba(239, 68, 68, 0.3)"
                                : "rgba(100, 116, 139, 0.3)"
                      }`
                    : undefined,
                }}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                <div
                  className={`
                  p-3 sm:p-4 rounded-t-2xl border-b
                  ${column.bg} ${column.border}
                `}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                      <div
                        className={`p-2 rounded-lg bg-gradient-to-br ${column.gradient} shadow-lg`}
                      >
                        <IconComponent size={16} className="text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-800 dark:text-white text-sm">
                          {column.title}
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {t("scheduler.kanban.taskCount", {
                            count: column.tasks.length,
                          })}
                        </p>
                      </div>
                    </div>
                    <div
                      className={`
                      px-2 py-1 rounded-full text-xs sm:text-sm font-bold
                      ${column.bg} ${column.text}
                    `}
                    >
                      {column.tasks.length}
                    </div>
                  </div>

                  {estimatedTime > 0 && (
                    <div className="flex items-center gap-2 mt-2 text-xs text-slate-500 dark:text-slate-400">
                      <Clock size={12} className={column.text} />
                      <span>
                        {t("scheduler.kanban.estimated")}{" "}
                        <span className="text-slate-800 dark:text-white font-medium">
                          {formatDuration(estimatedTime)}
                        </span>
                      </span>
                    </div>
                  )}
                </div>

                <div data-scrollable-queue className="flex-1 min-h-0 p-2 sm:p-3 overflow-y-auto custom-scrollbar">
                  {column.tasks.length === 0 ? (
                    <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                      <IconComponent
                        size={28}
                        className="mx-auto mb-2 opacity-30"
                      />
                      <p className="text-sm">{t("scheduler.kanban.noTasks")}</p>
                      {draggedTask && (
                        <p className="text-xs mt-1 text-slate-400 dark:text-slate-600">
                          {t("scheduler.kanban.dragHere")}
                        </p>
                      )}
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={column.tasks}
                      onReorder={() => {}}
                      className="space-y-2 sm:space-y-3"
                    >
                      <AnimatePresence>
                        {column.tasks.map((task) => (
                          <Reorder.Item
                            key={task.id}
                            value={task}
                            draggable
                            onDragStart={(e) =>
                              handleDragStart(
                                e as unknown as React.DragEvent,
                                task.id,
                                task.status,
                              )
                            }
                            onDragEnd={handleDragEnd}
                            className={`
                              cursor-grab active:cursor-grabbing
                              ${draggedTask === task.id ? "opacity-50 scale-95" : ""}
                            `}
                          >
                            <TaskCard
                              task={task}
                              onEditTask={onTaskClick}
                            />
                          </Reorder.Item>
                        ))}
                      </AnimatePresence>
                    </Reorder.Group>
                  )}
                </div>

                {isOver && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 rounded-2xl border-2 border-dashed border-slate-400/50 dark:border-white/30 bg-slate-200/30 dark:bg-white/5 pointer-events-none"
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
