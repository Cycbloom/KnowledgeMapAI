import React, { useState } from 'react';
import { Draggable } from '@hello-pangea/dnd';
import { Clock, Play, Pause, Check, Edit2, Trash2, Lock, Info } from 'lucide-react';
import { ScheduledTask } from '../../services/api/scheduler';

interface DraggableTaskCardProps {
  task: ScheduledTask;
  index: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
  onViewDetail?: () => void;
}

const QUEUE_COLORS = {
  0: {
    border: 'border-cyan-300 dark:border-cyan-400',
    glow: 'shadow-cyan-500/30',
    bg: 'bg-cyan-100 dark:bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    accent: 'bg-cyan-500',
    gradient: 'from-cyan-500 to-blue-500',
  },
  1: {
    border: 'border-emerald-300 dark:border-emerald-400',
    glow: 'shadow-emerald-500/30',
    bg: 'bg-emerald-100 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    accent: 'bg-emerald-500',
    gradient: 'from-emerald-500 to-teal-500',
  },
  2: {
    border: 'border-amber-300 dark:border-amber-400',
    glow: 'shadow-amber-500/30',
    bg: 'bg-amber-100 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    accent: 'bg-amber-500',
    gradient: 'from-amber-500 to-orange-500',
  },
};

const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  paused: { label: '已暂停', color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
};

export const DraggableTaskCard: React.FC<DraggableTaskCardProps> = ({
  task,
  index,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onComplete,
  onViewDetail,
}) => {
  const queueStyle = QUEUE_COLORS[task.queue_level as keyof typeof QUEUE_COLORS] || QUEUE_COLORS[0];
  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
  const [showDragTip, setShowDragTip] = useState(false);
  const isInProgress = task.status === 'in_progress';

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '--';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h${mins}m` : `${hours}h`;
  };

  const hasActions = (task.status === 'pending' && onStart) ||
    (task.status === 'paused' && onStart) ||
    (task.status === 'in_progress' && onPause) ||
    ((task.status === 'pending' || task.status === 'in_progress' || task.status === 'paused') && onComplete) ||
    onEdit || onDelete;

  return (
    <Draggable draggableId={task.id} index={index} isDragDisabled={isInProgress}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...(isInProgress ? {} : provided.dragHandleProps)}
          onMouseEnter={() => isInProgress && setShowDragTip(true)}
          onMouseLeave={() => setShowDragTip(false)}
          className={`
            group relative rounded-xl border transition-all duration-200
            ${isInProgress ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing'}
            ${snapshot.isDragging 
              ? 'shadow-2xl z-[9999] ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900 opacity-95' 
              : 'hover:shadow-lg'
            }
            ${queueStyle.border} ${snapshot.isDragging ? queueStyle.glow : ''}
            ${isInProgress ? 'ring-2 ring-blue-400/50 dark:ring-blue-500/50' : ''}
            bg-white dark:bg-slate-900/80 backdrop-blur-sm
            overflow-hidden flex-shrink-0
          `}
          style={{
            ...provided.draggableProps.style,
            width: '180px',
          }}
        >
          <div className={`absolute left-0 top-0 bottom-0 w-1 ${queueStyle.accent}`} />
          
          <div className="p-3 pl-4">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${queueStyle.badge}`}>
                Q{task.queue_level}
              </span>
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
              {task.priority >= 3 && (
                <span className="text-red-500 dark:text-red-400 text-xs">★</span>
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
              {task.status === 'pending' && onStart && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStart(); }}
                  className={`p-1 rounded transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
                  title="开始"
                >
                  <Play size={12} />
                </button>
              )}

              {task.status === 'paused' && onStart && (
                <button
                  onClick={(e) => { e.stopPropagation(); onStart(); }}
                  className={`p-1 rounded transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
                  title="继续"
                >
                  <Play size={12} />
                </button>
              )}

              {task.status === 'in_progress' && onPause && (
                <button
                  onClick={(e) => { e.stopPropagation(); onPause(); }}
                  className="p-1 rounded bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all hover:scale-110"
                  title="暂停"
                >
                  <Pause size={12} />
                </button>
              )}

              {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'paused') && onComplete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onComplete(); }}
                  className="p-1 rounded bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-110"
                  title="完成"
                >
                  <Check size={12} />
                </button>
              )}

              {onViewDetail && (
                <button
                  onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
                  className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-all hover:scale-110"
                  title="详情"
                >
                  <Info size={12} />
                </button>
              )}

              {onEdit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(); }}
                  className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all hover:scale-110"
                  title="编辑"
                >
                  <Edit2 size={12} />
                </button>
              )}

              {onDelete && (
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(); }}
                  className="p-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          )}

          {task.status === 'in_progress' && (
            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${queueStyle.bg} overflow-hidden`}>
              <div 
                className={`h-full ${queueStyle.accent} animate-pulse`}
                style={{ width: '60%' }}
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
      )}
    </Draggable>
  );
};
