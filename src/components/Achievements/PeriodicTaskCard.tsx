import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, BookOpen, Zap, ListTodo } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PeriodicTaskCardProps {
  task: {
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
  };
}

const taskTypeConfig = {
  focus: { icon: Clock, color: 'from-primary-500 to-primary-500' },
  study: { icon: BookOpen, color: 'from-green-500 to-emerald-500' },
  create: { icon: Zap, color: 'from-primary-500 to-pink-500' },
  tasks: { icon: ListTodo, color: 'from-orange-500 to-amber-500' },
} as const;

const taskTypeLabelKeys = {
  focus: 'focusTime',
  study: 'studyCards',
  create: 'createNodes',
  tasks: 'completeTasks',
} as const;

const taskTypeUnitKeys = {
  focus: 'minutes',
  study: 'cards',
  create: 'items',
  tasks: 'items',
} as const;

const periodTypeKeys = {
  weekly: 'week',
  monthly: 'month',
  quarterly: 'quarter',
} as const;

const PeriodicTaskCardComponent: React.FC<PeriodicTaskCardProps> = ({ task }) => {
  const { t } = useTranslation();
  const config = taskTypeConfig[task.task_type];
  const Icon = config.icon;
  const progressPercent = Math.min(100, (task.progress / task.target) * 100);
  const isCompleted = task.status === 'completed';

  const label = t(`achievements.periodicTask.label.${taskTypeLabelKeys[task.task_type]}` as const);
  const unit = t(`achievements.periodicTask.unit.${taskTypeUnitKeys[task.task_type]}` as const);
  const period = t(`achievements.periodicTask.period.${periodTypeKeys[task.period_type]}` as const);
  const title = t('achievements.periodicTask.title', { period, label });
  const progressText = t('achievements.periodicTask.progress', {
    current: task.progress,
    target: task.target,
    unit,
  });
  const pointsLabel = t('achievements.periodicTask.pointsLabel');

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white dark:bg-slate-800 rounded-xl p-4 border transition-all ${
        isCompleted
          ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20'
          : 'border-slate-200 dark:border-slate-500'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-slate-900 dark:text-white">
              {title}
            </h4>
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5 text-slate-400 dark:text-slate-600" />
            )}
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500 dark:text-slate-400">
                {progressText}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuenow={Math.round(progressPercent)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={t('common.aria.progress')}
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden"
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
                className={`h-full rounded-full bg-gradient-to-r ${config.color}`}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1">
              <span className="text-amber-500">⭐</span>
              {task.xp_reward} XP
            </span>
            <span className="flex items-center gap-1">
              <span className="text-primary-500">🎫</span>
              {task.pass_points} {pointsLabel}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const PeriodicTaskCard = React.memo(PeriodicTaskCardComponent);
