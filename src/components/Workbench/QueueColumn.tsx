import React from "react";
import { useTranslation } from "react-i18next";
import { Plus, Timer, Layers, ChevronRight } from "lucide-react";
import type { UserTask } from "@shared/types";
import { QUEUE_COLORS, type QueueLevel } from "@/constants/scheduler";
import { TaskCard } from "./TaskCard";

interface DeadlineInfo {
  text: string;
  color: string;
}

interface QueueColumnProps {
  level: number;
  title: string;
  tasks: UserTask[];
  timeSlice: number;
  getStatusLabel: (status: string) => string;
  formatDuration: (minutes: number) => string;
  formatDeadline: (date?: string) => DeadlineInfo | null;
  onStartTask: (task: UserTask) => void;
  onPauseTask: (task: UserTask) => void;
  onCompleteTask: (task: UserTask) => void;
  onEditTask: (task: UserTask) => void;
  onDeleteTask: (task: UserTask) => void;
  onLinkKnowledgePoint: (taskId: string) => void;
  onAddTask: (queueLevel: number) => void;
  onViewMore: () => void;
}

export const QueueColumn: React.FC<QueueColumnProps> = ({
  level,
  title,
  tasks,
  timeSlice,
  getStatusLabel,
  formatDuration,
  formatDeadline,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onEditTask,
  onDeleteTask,
  onLinkKnowledgePoint,
  onAddTask,
  onViewMore,
}) => {
  const { t } = useTranslation();
  const queueStyle = QUEUE_COLORS[level as QueueLevel] || QUEUE_COLORS[0];

  return (
    <div className="flex flex-col h-full">
      <div className={`flex-shrink-0 p-3 rounded-t-xl ${queueStyle.bg} border-b ${queueStyle.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 dark:text-white">{title}</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{t("unifiedWorkbench.labels.taskCount", { count: tasks.length })}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
            <Timer size={12} />
            <span>{t("unifiedWorkbench.labels.timeSliceMinutes", { count: timeSlice })}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-2 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-slate-500">
            <Layers size={24} className="mb-2 opacity-50" />
            <p className="text-xs">{t("unifiedWorkbench.tips.noTasks")}</p>
          </div>
        ) : (
          tasks.slice(0, 5).map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              queueLevel={level}
              getStatusLabel={getStatusLabel}
              formatDuration={formatDuration}
              formatDeadline={formatDeadline}
              onStartTask={onStartTask}
              onPauseTask={onPauseTask}
              onCompleteTask={onCompleteTask}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onLinkKnowledgePoint={onLinkKnowledgePoint}
            />
          ))
        )}
        {tasks.length > 5 && (
          <button
            onClick={onViewMore}
            className="w-full py-2 text-xs text-slate-500 dark:text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition-colors flex items-center justify-center gap-1"
          >
            {t("unifiedWorkbench.actions.viewMore", { count: tasks.length - 5 })}
            <ChevronRight size={12} />
          </button>
        )}
      </div>

      <div className="flex-shrink-0 p-2 border-t border-slate-200 dark:border-slate-800/50">
        <button
          onClick={() => onAddTask(level)}
          className={`w-full py-2 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-1 ${queueStyle.bg} ${queueStyle.text} hover:opacity-80`}
        >
          <Plus size={14} />
          {t("unifiedWorkbench.actions.addTask")}
        </button>
      </div>
    </div>
  );
};
