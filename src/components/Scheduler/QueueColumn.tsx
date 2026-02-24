import React, { useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Clock, Plus, ChevronDown, ChevronUp, Zap, Target, ListTodo } from 'lucide-react';
import { ScheduledTask } from '../../services/api/scheduler';
import { TaskCard } from './TaskCard';

interface QueueColumnProps {
  level: number;
  title: string;
  timeSlice: number;
  tasks: ScheduledTask[];
  onTaskClick?: (task: ScheduledTask) => void;
  onTaskMove?: (taskId: string, targetQueue: number) => void;
  onReorder?: (taskIds: string[]) => void;
  onEditTask?: (task: ScheduledTask) => void;
  onDeleteTask?: (task: ScheduledTask) => void;
  onStartTask?: (task: ScheduledTask) => void;
  onPauseTask?: (task: ScheduledTask) => void;
  onCompleteTask?: (task: ScheduledTask) => void;
  onAddTask?: () => void;
}

const QUEUE_CONFIG = {
  0: {
    icon: Zap,
    gradient: 'from-cyan-500 to-blue-500',
    border: 'border-cyan-300 dark:border-cyan-400/50',
    glow: 'shadow-cyan-500/20',
    headerBg: 'bg-gradient-to-r from-cyan-100 to-blue-100 dark:from-cyan-500/20 dark:to-blue-500/20',
    accentColor: 'text-cyan-600 dark:text-cyan-400',
    badgeBg: 'bg-cyan-100 dark:bg-cyan-500/20',
    description: '紧急重要任务',
  },
  1: {
    icon: Target,
    gradient: 'from-emerald-500 to-teal-500',
    border: 'border-emerald-300 dark:border-emerald-400/50',
    glow: 'shadow-emerald-500/20',
    headerBg: 'bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20',
    accentColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 dark:bg-emerald-500/20',
    description: '重要任务',
  },
  2: {
    icon: ListTodo,
    gradient: 'from-amber-500 to-orange-500',
    border: 'border-amber-300 dark:border-amber-400/50',
    glow: 'shadow-amber-500/20',
    headerBg: 'bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-500/20 dark:to-orange-500/20',
    accentColor: 'text-amber-600 dark:text-amber-400',
    badgeBg: 'bg-amber-100 dark:bg-amber-500/20',
    description: '待办任务',
  },
};

export const QueueColumn: React.FC<QueueColumnProps> = ({
  level,
  title,
  timeSlice,
  tasks,
  onTaskClick: _onTaskClick,
  onTaskMove,
  onReorder,
  onEditTask,
  onDeleteTask,
  onStartTask,
  onPauseTask,
  onCompleteTask,
  onAddTask,
}) => {
  void _onTaskClick;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [draggedOver, setDraggedOver] = useState(false);
  const config = QUEUE_CONFIG[level as keyof typeof QUEUE_CONFIG] || QUEUE_CONFIG[2];
  const IconComponent = config.icon;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOver(true);
  };

  const handleDragLeave = () => {
    setDraggedOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedOver(false);
    const taskId = e.dataTransfer.getData('taskId');
    const sourceQueue = e.dataTransfer.getData('sourceQueue');
    if (taskId && sourceQueue && onTaskMove && parseInt(sourceQueue) !== level) {
      onTaskMove(taskId, level);
    }
  };

  const handleReorder = (newOrder: ScheduledTask[]) => {
    if (onReorder) {
      onReorder(newOrder.map(t => t.id));
    }
  };

  const formatTimeSlice = (minutes: number) => {
    if (minutes < 60) return `${minutes}分钟`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const totalEstimatedTime = tasks.reduce((sum, t) => sum + (t.estimated_duration || 0), 0);
  const pendingTasks = tasks.filter(t => t.status === 'pending');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');

  return (
    <div
      className={`
        flex flex-col rounded-2xl border transition-all duration-300
        ${config.border} ${config.glow}
        ${draggedOver ? 'ring-2 ring-offset-2 ring-offset-slate-50 dark:ring-offset-slate-900' : ''}
        bg-white/90 dark:bg-slate-900/60 backdrop-blur-sm
        min-w-[320px] max-w-[380px]
      `}
      style={{
        boxShadow: draggedOver 
          ? `0 0 30px ${level === 0 ? 'rgba(34, 211, 238, 0.3)' : level === 1 ? 'rgba(52, 211, 153, 0.3)' : 'rgba(251, 191, 36, 0.3)'}`
          : undefined,
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className={`${config.headerBg} rounded-t-2xl p-4 border-b ${config.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg bg-gradient-to-br ${config.gradient} shadow-lg`}>
              <IconComponent size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${config.badgeBg} ${config.accentColor}`}>
                  Q{level}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">{config.description}</p>
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
            <span>时间片: <span className={config.accentColor}>{formatTimeSlice(timeSlice)}</span></span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
            <span>任务: <span className="text-slate-900 dark:text-white font-medium">{tasks.length}</span></span>
          </div>
          {totalEstimatedTime > 0 && (
            <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
              <span>预计: <span className="text-slate-900 dark:text-white font-medium">{formatTimeSlice(totalEstimatedTime)}</span></span>
            </div>
          )}
        </div>

        {inProgressTasks.length > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
            <span className="text-xs text-blue-600 dark:text-blue-400">{inProgressTasks.length} 个任务进行中</span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 overflow-hidden"
          >
            <div className="p-3 space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto custom-scrollbar">
              {pendingTasks.length === 0 && inProgressTasks.length === 0 ? (
                <div className="text-center py-8 text-slate-400 dark:text-slate-500">
                  <IconComponent size={32} className="mx-auto mb-2 opacity-40 dark:opacity-30" />
                  <p className="text-sm">暂无任务</p>
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
                <Reorder.Group
                  axis="y"
                  values={tasks}
                  onReorder={handleReorder}
                  className="space-y-3"
                >
                  <AnimatePresence>
                    {tasks.map((task) => (
                      <Reorder.Item
                        key={task.id}
                        value={task}
                        className="cursor-grab active:cursor-grabbing"
                        onDragStart={(e) => {
                          const target = e.target as HTMLElement;
                          target.setAttribute('data-task-id', task.id);
                          target.setAttribute('data-source-queue', level.toString());
                        }}
                      >
                        <TaskCard
                          task={task}
                          onEdit={onEditTask ? () => onEditTask(task) : undefined}
                          onDelete={onDeleteTask ? () => onDeleteTask(task) : undefined}
                          onStart={onStartTask ? () => onStartTask(task) : undefined}
                          onPause={onPauseTask ? () => onPauseTask(task) : undefined}
                          onComplete={onCompleteTask ? () => onCompleteTask(task) : undefined}
                        />
                      </Reorder.Item>
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
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
