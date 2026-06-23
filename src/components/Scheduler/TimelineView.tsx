import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Calendar, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { UserTask } from '@shared/types';
import { TaskCard } from './TaskCard';

interface TimelineViewProps {
  tasks: UserTask[];
  onTaskClick?: (task: UserTask) => void;
  onTaskMove?: (taskId: string, newDeadline: string) => void;
}

const QUEUE_COLORS = {
  0: { border: 'border-primary-400 dark:border-primary-400', glow: 'shadow-primary-500/30', bg: 'bg-primary-100 dark:bg-primary-500/10', text: 'text-primary-600 dark:text-primary-400' },
  1: { border: 'border-secondary-400 dark:border-secondary-400', glow: 'shadow-secondary-500/30', bg: 'bg-secondary-100 dark:bg-secondary-500/10', text: 'text-secondary-600 dark:text-secondary-400' },
  2: { border: 'border-tertiary-400 dark:border-tertiary-400', glow: 'shadow-tertiary-500/30', bg: 'bg-tertiary-100 dark:bg-tertiary-500/10', text: 'text-tertiary-600 dark:text-tertiary-400' },
};

export const TimelineView: React.FC<TimelineViewProps> = ({
  tasks,
  onTaskClick,
  onTaskMove,
}) => {
  const { t } = useTranslation();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const timelineData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const days: { date: Date; label: string; tasks: UserTask[]; isToday: boolean; isPast: boolean }[] = [];
    
    for (let i = -3; i <= 10; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const dayTasks = tasks.filter((task) => {
        if (!task.deadline) return i === 0;
        const taskDate = new Date(task.deadline);
        taskDate.setHours(0, 0, 0, 0);
        return taskDate.getTime() === date.getTime();
      });

      const isToday = date.getTime() === today.getTime();
      const isPast = date < today;
      
      const label = isToday 
        ? t('scheduler.timeline.today') 
        : isPast 
          ? `${date.getMonth() + 1}/${date.getDate()}`
          : i === 1 
            ? t('scheduler.timeline.tomorrow') 
            : `${date.getMonth() + 1}/${date.getDate()}`;
      
      days.push({ date, label, tasks: dayTasks, isToday, isPast });
    }
    
    return days;
  }, [tasks, currentDate]);

  const overdueTasks = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return tasks.filter((task) => {
      if (!task.deadline || task.status === 'completed' || task.status === 'cancelled') return false;
      const deadline = new Date(task.deadline);
      deadline.setHours(0, 0, 0, 0);
      return deadline < today;
    });
  }, [tasks]);

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    setDraggedTask(taskId);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDrop = (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');
    if (taskId && onTaskMove) {
      const newDeadline = targetDate.toISOString();
      onTaskMove(taskId, newDeadline);
    }
    setDraggedTask(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentDate(newDate);
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3 px-2">
        <div className="flex items-center gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-slate-800 dark:text-white">{t('scheduler.timeline.viewTitle')}</h3>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            <Calendar size={14} />
            <span>{currentDate.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' })}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateDate('prev')}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all min-h-[44px] min-w-[44px]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-4 py-2 rounded-lg bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 text-sm font-medium hover:bg-primary-200 dark:hover:bg-primary-500/30 transition-all min-h-[44px]"
          >
            {t('scheduler.timeline.today')}
          </button>
          <button
            onClick={() => navigateDate('next')}
            className="p-2.5 rounded-lg bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-all min-h-[44px] min-w-[44px]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-x-auto custom-scrollbar">
        <div className="flex gap-4 pb-4 min-w-max h-full">
          <AnimatePresence>
            {timelineData.map((day, index) => (
              <motion.div
                key={day.date.toISOString()}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.05 }}
                className={`
                  flex-shrink-0 w-64 sm:w-72 rounded-2xl border transition-all duration-300 flex flex-col
                  ${day.isToday 
                    ? 'border-primary-500/50 shadow-lg shadow-primary-500/20' 
                    : day.isPast 
                      ? 'border-slate-200 dark:border-slate-700/30 opacity-60' 
                      : 'border-slate-200 dark:border-slate-700/50'
                  }
                  bg-white dark:bg-slate-900/60 backdrop-blur-sm
                `}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, day.date)}
              >
                <div className={`
                  p-3 border-b
                  ${day.isToday 
                    ? 'bg-gradient-to-r from-primary-100 to-primary-100 dark:from-primary-500/20 dark:to-primary-500/20 border-primary-300 dark:border-primary-500/30' 
                    : 'border-slate-200 dark:border-slate-700/50'
                  }
                `}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {day.isToday && (
                        <span className="w-2 h-2 rounded-full bg-primary-500 dark:bg-primary-400 animate-pulse" />
                      )}
                      <span className={`font-semibold ${day.isToday ? 'text-primary-600 dark:text-primary-400' : 'text-slate-800 dark:text-white'}`}>
                        {day.label}
                      </span>
                    </div>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {t('scheduler.timeline.weekDay' + day.date.getDay())}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {t('scheduler.timeline.taskCount', { count: day.tasks.length })}
                  </div>
                </div>

                <div data-scrollable-queue className="p-2 flex-1 min-h-0 space-y-2 overflow-y-auto custom-scrollbar">
                  {day.tasks.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                      {day.isToday ? t('scheduler.timeline.noTasksToday') : t('scheduler.timeline.noTasks')}
                    </div>
                  ) : (
                    <Reorder.Group
                      axis="y"
                      values={day.tasks}
                      onReorder={() => {}}
                      className="space-y-2"
                    >
                      <AnimatePresence>
                        {day.tasks.map((task) => (
                          <Reorder.Item
                            key={task.id}
                            value={task}
                            draggable
                            onDragStart={(e) => handleDragStart(e as unknown as React.DragEvent, task.id)}
                            onDragEnd={handleDragEnd}
                            className={`
                              cursor-grab active:cursor-grabbing
                              ${draggedTask === task.id ? 'opacity-50' : ''}
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
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {overdueTasks.length > 0 && (
        <div className="flex-shrink-0 mt-4 pt-4 border-t border-slate-200 dark:border-slate-700/50">
          <div className="p-3 sm:p-4 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30">
            <div className="flex items-center gap-2 mb-2 sm:mb-3">
              <AlertCircle size={16} className="text-red-500 dark:text-red-400" />
              <span className="text-sm font-medium text-red-600 dark:text-red-400">{t('scheduler.timeline.overdue')} ({overdueTasks.length})</span>
            </div>
            <div className="space-y-2 max-h-32 sm:max-h-40 overflow-y-auto custom-scrollbar">
              {overdueTasks.map((task) => (
                <div
                  key={task.id}
                  className="p-2 rounded-lg bg-white dark:bg-slate-800/50 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors border border-slate-100 dark:border-transparent"
                  onClick={() => onTaskClick?.(task)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      QUEUE_COLORS[task.queue_level as keyof typeof QUEUE_COLORS]?.bg || 'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-400'
                    }`}>
                      Q{task.queue_level}
                    </span>
                    <span className="text-slate-800 dark:text-white truncate">{task.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
