import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, AlertTriangle, Zap, TrendingUp, Calendar, Tag, ClipboardList } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { TaskRecommendation as TaskRecommendationType } from '../../services/api/taskRecommendation';
import { UserTask } from '@shared/types';
import { QUEUE_COLORS, type QueueLevel } from '@/constants/scheduler';
import { formatDate } from '../../utils/formatters';
import { EmptyState } from '../common/EmptyState';

interface TaskRecommendationProps {
  recommendations: TaskRecommendationType[];
  onSelectTask?: (task: UserTask) => void;
  onStartTask?: (taskId: string) => void;
  isLoading?: boolean;
}

const URGENCY_CONFIG = {
  critical: {
    label: '紧急',
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-500/20',
    border: 'border-red-300 dark:border-red-500/50',
    icon: AlertTriangle,
  },
  high: {
    label: '高优先',
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-100 dark:bg-amber-500/20',
    border: 'border-amber-300 dark:border-amber-500/50',
    icon: Zap,
  },
  medium: {
    label: '中等',
    color: 'text-primary-600 dark:text-primary-400',
    bg: 'bg-primary-100 dark:bg-primary-500/20',
    border: 'border-primary-300 dark:border-primary-500/50',
    icon: TrendingUp,
  },
  low: {
    label: '低优先',
    color: 'text-slate-600 dark:text-slate-400',
    bg: 'bg-slate-100 dark:bg-slate-500/20',
    border: 'border-slate-300 dark:border-slate-500/50',
    icon: Clock,
  },
};

export const TaskRecommendation: React.FC<TaskRecommendationProps> = ({
  recommendations,
  onSelectTask,
  onStartTask,
  isLoading = false,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-800 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        <EmptyState
          icon={<ClipboardList size={32} />}
          title={t('scheduler.empty.recommendations')}
          action={{ label: t('scheduler.browseTasks'), onClick: () => navigate('/scheduler') }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AnimatePresence mode="popLayout">
        {recommendations.map((rec, index) => {
          const urgencyConfig = URGENCY_CONFIG[rec.urgencyLevel];
          const UrgencyIcon = urgencyConfig.icon;

          return (
            <motion.div
              key={rec.task.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => onSelectTask?.(rec.task)}
              className={`
                relative p-4 rounded-xl border cursor-pointer
                transition-all duration-200 hover:shadow-lg
                bg-white dark:bg-slate-900
                ${urgencyConfig.border}
              `}
            >
              <div className="flex items-start gap-3">
                <div className={`flex-shrink-0 p-2 rounded-lg ${urgencyConfig.bg}`}>
                  <UrgencyIcon className={`w-5 h-5 ${urgencyConfig.color}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${QUEUE_COLORS[rec.task.queue_level as QueueLevel].badge}`}>
                      Q{rec.task.queue_level}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${urgencyConfig.bg} ${urgencyConfig.color}`}>
                      {urgencyConfig.label}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      推荐分数: {Math.round(rec.score)}
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 dark:text-white mb-1 truncate">
                    {rec.task.title}
                  </h4>

                  {rec.task.description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1 mb-2">
                      {rec.task.description}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-2">
                    {rec.task.estimated_duration && (
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {rec.task.estimated_duration}分钟
                      </span>
                    )}
                    {rec.task.deadline && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {formatDate(rec.task.deadline, 'short')}
                      </span>
                    )}
                    {rec.task.tags && rec.task.tags.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Tag size={12} />
                        {rec.task.tags.slice(0, 2).join(', ')}
                      </span>
                    )}
                  </div>

                  {rec.reasons.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {rec.reasons.map((reason, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-full text-xs bg-primary-50 dark:bg-primary-500/10 text-primary-600 dark:text-primary-400"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {onStartTask && rec.task.status === 'pending' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onStartTask(rec.task.id);
                    }}
                    className={`
                      flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium
                      bg-gradient-to-r from-primary-500 to-primary-500 text-white
                      hover:from-primary-400 hover:to-primary-400
                      transition-all shadow-lg shadow-primary-500/20
                    `}
                  >
                    开始
                  </button>
                )}
              </div>

              {rec.suggestedTimeSlot && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <span className="text-xs text-slate-400 dark:text-slate-500">
                    建议时段: {rec.suggestedTimeSlot.label}
                  </span>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
