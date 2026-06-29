import React, { useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Clock,
  Play,
  Pause,
  Check,
  Edit2,
  Trash2,
  Lock,
  Info,
} from "lucide-react";
import { UserTask } from "@shared/types";

interface DraggableTaskCardProps {
  task: UserTask;
  onEditTask?: (task: UserTask) => void;
  onDeleteTask?: (task: UserTask) => void;
  onStartTask?: (task: UserTask) => void;
  onPauseTask?: (task: UserTask) => void;
  onCompleteTask?: (task: UserTask) => void;
  onViewTaskDetail?: (task: UserTask) => void;
}

const QUEUE_COLORS = {
  0: {
    border: "border-primary-300 dark:border-primary-400",
    glow: "shadow-primary-500/30",
    bg: "bg-primary-100 dark:bg-primary-500/10",
    text: "text-primary-600 dark:text-primary-400",
    badge: "bg-primary-100 text-primary-700 dark:bg-primary-500/20 dark:text-primary-300",
    accent: "bg-primary-500",
    gradient: "from-primary-500 to-primary-600",
  },
  1: {
    border: "border-secondary-300 dark:border-secondary-400",
    glow: "shadow-secondary-500/30",
    bg: "bg-secondary-100 dark:bg-secondary-500/10",
    text: "text-secondary-600 dark:text-secondary-400",
    badge:
      "bg-secondary-100 text-secondary-700 dark:bg-secondary-500/20 dark:text-secondary-300",
    accent: "bg-secondary-500",
    gradient: "from-secondary-500 to-secondary-600",
  },
  2: {
    border: "border-tertiary-300 dark:border-tertiary-400",
    glow: "shadow-tertiary-500/30",
    bg: "bg-tertiary-100 dark:bg-tertiary-500/10",
    text: "text-tertiary-600 dark:text-tertiary-400",
    badge:
      "bg-tertiary-100 text-tertiary-700 dark:bg-tertiary-500/20 dark:text-tertiary-300",
    accent: "bg-tertiary-500",
    gradient: "from-tertiary-500 to-tertiary-600",
  },
};

const STATUS_CONFIG = {
  pending: {
    label: "待处理",
    color:
      "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400",
  },
  in_progress: {
    label: "进行中",
    color: "bg-primary-100 text-primary-600 dark:bg-primary-500/20 dark:text-primary-400",
  },
  paused: {
    label: "已暂停",
    color:
      "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
  },
  completed: {
    label: "已完成",
    color:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
  },
  cancelled: {
    label: "已取消",
    color: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400",
  },
};

const DraggableTaskCardInner: React.FC<DraggableTaskCardProps> = ({
  task,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onViewTaskDetail,
}) => {
  const queueStyle =
    QUEUE_COLORS[task.queue_level as keyof typeof QUEUE_COLORS] ||
    QUEUE_COLORS[0];
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const [showDragTip, setShowDragTip] = useState(false);
  const isInProgress = task.status === "in_progress";

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
    disabled: isInProgress,
  });

  const style: React.CSSProperties = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
    width: "180px",
  };

  // 保留本地实现：< 60 分钟使用中文，>= 60 分钟使用无空格紧凑格式 "XhYm"，混合格式无法直接复用 @/utils/formatters
  const formatDuration = (minutes?: number) => {
    if (!minutes) return "--";
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  };

  const hasActions =
    (task.status === "pending" && onStartTask) ||
    (task.status === "paused" && onStartTask) ||
    (task.status === "in_progress" && onPauseTask) ||
    ((task.status === "pending" ||
      task.status === "in_progress" ||
      task.status === "paused") &&
      onCompleteTask) ||
    onEditTask ||
    onDeleteTask;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...(isInProgress ? {} : listeners)}
      onMouseEnter={() => isInProgress && setShowDragTip(true)}
      onMouseLeave={() => setShowDragTip(false)}
      className={`
        group relative rounded-xl border transition-all duration-200
        ${isInProgress ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"}
        ${isDragging ? "opacity-30" : "hover:shadow-lg"}
        ${queueStyle.border}
        ${isInProgress ? "ring-2 ring-primary-400/50 dark:ring-primary-500/50" : ""}
        bg-white dark:bg-slate-900/80 backdrop-blur-sm
        overflow-hidden flex-shrink-0
      `}
    >
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${queueStyle.accent}`}
      />

      <div className="p-3 pl-4">
        <div className="flex items-center gap-1.5 mb-1.5">
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
            <span className="text-red-500 dark:text-red-400 text-xs">
              ★
            </span>
          )}
        </div>

        <h4 className="font-medium text-slate-900 dark:text-white text-sm mb-1 truncate pr-2">
          {task.title}
        </h4>

        {task.description && (
          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-500">
          {task.estimated_duration && (
            <div className="flex items-center gap-1">
              <Clock size={12} className={queueStyle.text} />
              <span>{formatDuration(task.estimated_duration)}</span>
            </div>
          )}
        </div>
      </div>

      {hasActions && (
        <div
          className={`
                flex items-center justify-center gap-1 px-2 py-1.5
                bg-slate-50/80 dark:bg-slate-800/50
                border-t border-slate-100 dark:border-slate-700/50
                opacity-0 group-hover:opacity-100
                transition-opacity duration-200
              `}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {task.status === "pending" && onStartTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartTask(task);
              }}
              className={`p-1 rounded transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
              title="开始"
            >
              <Play size={12} />
            </button>
          )}

          {task.status === "paused" && onStartTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStartTask(task);
              }}
              className={`p-1 rounded transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
              title="继续"
            >
              <Play size={12} />
            </button>
          )}

          {task.status === "in_progress" && onPauseTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPauseTask(task);
              }}
              className="p-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all hover:scale-110"
              title="暂停"
            >
              <Pause size={12} />
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
                className="p-1 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-110"
                title="完成"
              >
                <Check size={12} />
              </button>
            )}

          {onViewTaskDetail && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onViewTaskDetail(task);
              }}
              className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all hover:scale-110"
              title="详情"
            >
              <Info size={12} />
            </button>
          )}

          {onEditTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditTask(task);
              }}
              className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all hover:scale-110"
              title="编辑"
            >
              <Edit2 size={12} />
            </button>
          )}

          {onDeleteTask && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteTask(task);
              }}
              className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110"
              title="删除"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      )}

      {task.status === "in_progress" && (
        <div
          className={`absolute bottom-0 left-0 right-0 h-0.5 ${queueStyle.bg} overflow-hidden`}
        >
          <div
            className={`h-full ${queueStyle.accent} animate-pulse`}
            style={{ width: "60%" }}
          />
        </div>
      )}

      {showDragTip && isInProgress && (
        <div className="absolute top-0 left-0 right-0 bottom-10 flex items-center justify-center bg-black/60 backdrop-blur-sm rounded-t-xl z-10 pointer-events-none">
          <div className="flex items-center gap-2 text-white text-xs px-3 py-2 bg-slate-800/90 rounded-lg shadow-lg pointer-events-auto">
            <Lock size={14} />
            <span>请先暂停任务再移动</span>
          </div>
        </div>
      )}
    </div>
  );
};

const areEqual = (prev: DraggableTaskCardProps, next: DraggableTaskCardProps) => {
  return (
    prev.task.id === next.task.id &&
    prev.task.status === next.task.status &&
    prev.task.updated_at === next.task.updated_at
  );
};

export const DraggableTaskCard = React.memo(DraggableTaskCardInner, areEqual);
