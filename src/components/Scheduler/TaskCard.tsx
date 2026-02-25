import React from 'react';
import { motion } from 'framer-motion';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Clock, Calendar, Tag, Play, Pause, Check, Edit2, Trash2 } from 'lucide-react';
import { ScheduledTask } from '../../services/api/scheduler';

interface TaskCardProps {
  task: ScheduledTask;
  onEdit?: () => void;
  onDelete?: () => void;
  onStart?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
}

const QUEUE_COLORS = {
  0: {
    border: 'border-cyan-300 dark:border-cyan-400',
    glow: 'shadow-cyan-500/30',
    bg: 'bg-cyan-100 dark:bg-cyan-500/10',
    text: 'text-cyan-600 dark:text-cyan-400',
    badge: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/20 dark:text-cyan-300',
    accent: 'bg-cyan-500',
  },
  1: {
    border: 'border-emerald-300 dark:border-emerald-400',
    glow: 'shadow-emerald-500/30',
    bg: 'bg-emerald-100 dark:bg-emerald-500/10',
    text: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    accent: 'bg-emerald-500',
  },
  2: {
    border: 'border-amber-300 dark:border-amber-400',
    glow: 'shadow-amber-500/30',
    bg: 'bg-amber-100 dark:bg-amber-500/10',
    text: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    accent: 'bg-amber-500',
  },
};

const STATUS_CONFIG = {
  pending: { label: '待处理', color: 'bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  paused: { label: '已暂停', color: 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400' },
  completed: { label: '已完成', color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
};

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onStart,
  onPause,
  onComplete,
}) => {
  const queueStyle = QUEUE_COLORS[task.queue_level as keyof typeof QUEUE_COLORS] || QUEUE_COLORS[0];
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
      type: 'task',
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const formatDuration = (minutes?: number) => {
    if (!minutes) return '--';
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
  };

  const formatDeadline = (date?: string) => {
    if (!date) return null;
    const d = new Date(date);
    const now = new Date();
    const diff = d.getTime() - now.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { text: '已过期', color: 'text-red-500 dark:text-red-400' };
    if (days === 0) return { text: '今天', color: 'text-amber-500 dark:text-amber-400' };
    if (days === 1) return { text: '明天', color: 'text-yellow-500 dark:text-yellow-400' };
    if (days <= 7) return { text: `${days}天后`, color: 'text-blue-500 dark:text-blue-400' };
    return { text: d.toLocaleDateString(), color: 'text-slate-500 dark:text-slate-400' };
  };

  const deadlineInfo = formatDeadline(task.deadline);

  const hasActions = (task.status === 'pending' && onStart) ||
    (task.status === 'in_progress' && onPause) ||
    ((task.status === 'pending' || task.status === 'in_progress' || task.status === 'paused') && onComplete) ||
    onEdit || onDelete;

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: isDragging ? 0.9 : 1, y: 0, scale: isDragging ? 1.02 : 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={style}
      {...attributes}
      {...listeners}
      className={`
        group relative rounded-xl border transition-all duration-200 cursor-grab active:cursor-grabbing
        ${isDragging ? 'shadow-2xl z-50 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900' : 'hover:shadow-lg'}
        ${queueStyle.border} ${isDragging ? queueStyle.glow : ''}
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
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${queueStyle.accent}`} />
        
        <div className="p-3 pl-4">
          <div className="flex items-center gap-2 mb-1.5">
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

          <h4 className="font-medium text-slate-900 dark:text-white mb-1 truncate pr-2">{task.title}</h4>
          
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-2">{task.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-500">
            {task.estimated_duration && (
              <div className="flex items-center gap-1">
                <Clock size={12} className={queueStyle.text} />
                <span>{formatDuration(task.estimated_duration)}</span>
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
                <Tag size={12} className="text-indigo-500 dark:text-indigo-400" />
                <span className="text-indigo-500 dark:text-indigo-400">{task.tags.slice(0, 2).join(', ')}{task.tags.length > 2 ? '...' : ''}</span>
              </div>
            )}
          </div>
        </div>

        {hasActions && (
          <div 
            className={`
              flex items-center justify-end gap-1 px-3 py-2
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
                className={`p-1.5 rounded-md transition-all hover:scale-110 ${queueStyle.bg} ${queueStyle.text}`}
                title="开始"
              >
                <Play size={14} />
              </button>
            )}

            {task.status === 'in_progress' && onPause && (
              <button
                onClick={(e) => { e.stopPropagation(); onPause(); }}
                className="p-1.5 rounded-md bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 transition-all hover:scale-110"
                title="暂停"
              >
                <Pause size={14} />
              </button>
            )}

            {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'paused') && onComplete && (
              <button
                onClick={(e) => { e.stopPropagation(); onComplete(); }}
                className="p-1.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 transition-all hover:scale-110"
                title="完成"
              >
                <Check size={14} />
              </button>
            )}

            {onEdit && (
              <button
                onClick={(e) => { e.stopPropagation(); onEdit(); }}
                className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 transition-all hover:scale-110"
                title="编辑"
              >
                <Edit2 size={14} />
              </button>
            )}

            {onDelete && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110"
                title="删除"
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        )}

        {task.status === 'in_progress' && (
          <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${queueStyle.bg} overflow-hidden`}>
            <motion.div
              className={`h-full ${queueStyle.accent}`}
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>
        )}
    </motion.div>
  );
};
