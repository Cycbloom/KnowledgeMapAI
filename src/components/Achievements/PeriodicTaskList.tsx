import React from 'react';
import { motion } from 'framer-motion';
import { PeriodicTaskCard } from './PeriodicTaskCard';
import { useTranslation } from 'react-i18next';

interface PeriodicTaskListProps {
  tasks: Array<{
    id: string;
    period_type: 'weekly' | 'monthly' | 'quarterly';
    task_type: 'focus' | 'study' | 'create' | 'tasks';
    target: number;
    progress: number;
    status: 'pending' | 'completed';
    xp_reward: number;
    pass_points: number;
    period_start: string;
    period_end: string;
  }>;
}

export const PeriodicTaskList: React.FC<PeriodicTaskListProps> = ({ tasks }) => {
  const { t } = useTranslation();
  
  const periodTypeConfig = {
    weekly: { label: t('achievements.periodic.weekly'), icon: '📅', color: 'from-blue-500 to-cyan-500' },
    monthly: { label: t('achievements.periodic.monthly'), icon: '📆', color: 'from-purple-500 to-pink-500' },
    quarterly: { label: t('achievements.periodic.quarterly'), icon: '🗓️', color: 'from-orange-500 to-red-500' },
  };
  const groupedTasks = React.useMemo(() => {
    const groups: Record<string, typeof tasks> = {
      weekly: [],
      monthly: [],
      quarterly: [],
    };
    
    tasks.forEach(task => {
      if (groups[task.period_type]) {
        groups[task.period_type].push(task);
      }
    });
    
    return groups;
  }, [tasks]);

  const getPeriodStats = (periodTasks: typeof tasks) => {
    const completed = periodTasks.filter(t => t.status === 'completed').length;
    const total = periodTasks.length;
    const totalXp = periodTasks.reduce((acc, t) => acc + (t.status === 'completed' ? t.xp_reward : 0), 0);
    return { completed, total, totalXp };
  };

  return (
    <div className="space-y-6">
      {(['weekly', 'monthly', 'quarterly'] as const).map(periodType => {
        const periodTasks = groupedTasks[periodType];
        if (periodTasks.length === 0) return null;
        
        const config = periodTypeConfig[periodType];
        const stats = getPeriodStats(periodTasks);
        
        return (
          <motion.div
            key={periodType}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.icon}</span>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  {config.label}
                </h3>
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  ({stats.completed}/{stats.total})
                </span>
              </div>
              {stats.totalXp > 0 && (
                <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                  +{stats.totalXp} XP
                </span>
              )}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {periodTasks.map(task => (
                <PeriodicTaskCard key={task.id} task={task} />
              ))}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
};
