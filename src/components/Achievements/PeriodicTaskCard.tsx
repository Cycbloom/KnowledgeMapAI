import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Clock, BookOpen, Zap, ListTodo } from 'lucide-react';

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

const taskTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string; unit: string }> = {
  focus: { label: '专注时间', icon: Clock, color: 'from-primary-500 to-primary-500', unit: '分钟' },
  study: { label: '学习卡片', icon: BookOpen, color: 'from-green-500 to-emerald-500', unit: '张' },
  create: { label: '创建节点', icon: Zap, color: 'from-primary-500 to-pink-500', unit: '个' },
  tasks: { label: '完成任务', icon: ListTodo, color: 'from-orange-500 to-amber-500', unit: '个' },
};

const periodTypeLabels: Record<string, string> = {
  weekly: '周',
  monthly: '月',
  quarterly: '季度',
};

const PeriodicTaskCardComponent: React.FC<PeriodicTaskCardProps> = ({ task }) => {
  const config = taskTypeConfig[task.task_type];
  const Icon = config.icon;
  const progressPercent = Math.min(100, (task.progress / task.target) * 100);
  const isCompleted = task.status === 'completed';

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative bg-white dark:bg-slate-800 rounded-xl p-4 border transition-all ${
        isCompleted
          ? 'border-green-300 dark:border-green-700 bg-green-50/50 dark:bg-green-900/20'
          : 'border-slate-200 dark:border-slate-700'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${config.color}`}>
          <Icon className="w-5 h-5 text-white" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <h4 className="font-medium text-slate-900 dark:text-white">
              {periodTypeLabels[task.period_type]}{config.label}
            </h4>
            {isCompleted ? (
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            ) : (
              <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
            )}
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500 dark:text-slate-400">
                {task.progress} / {task.target} {config.unit}
              </span>
              <span className="text-slate-600 dark:text-slate-300 font-medium">
                {Math.round(progressPercent)}%
              </span>
            </div>
            <div className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
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
              {task.pass_points} 积分
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const PeriodicTaskCard = React.memo(PeriodicTaskCardComponent);
