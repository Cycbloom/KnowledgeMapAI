import React, { useEffect, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Flame, Calendar, Award } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { formatNumber } from '../../utils/formatters';
import { useCelebration } from '@/hooks/common';

/** 连续打卡里程碑:命中这些天数时触发庆祝动画 */
const STREAK_MILESTONES = [7, 30, 100];

interface StreakDisplayProps {
  dailyStreak: number;
  weeklyStreak: number;
  monthlyStreak: number;
  quarterlyStreak: number;
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  dailyStreak,
  weeklyStreak,
  monthlyStreak,
  quarterlyStreak,
}) => {
  const { t } = useTranslation();
  const { triggerCelebration } = useCelebration();
  // 记录上次触发过庆祝的天数,避免重复触发(同一里程碑只在首次达成时庆祝)
  const celebratedRef = useRef<Set<number>>(new Set());

  // 任务 19.4:dailyStreak 命中 7/30/100 里程碑时触发庆祝动画
  useEffect(() => {
    if (STREAK_MILESTONES.includes(dailyStreak) && !celebratedRef.current.has(dailyStreak)) {
      celebratedRef.current.add(dailyStreak);
      triggerCelebration("streak-milestone");
    }
  }, [dailyStreak, triggerCelebration]);

  const streakConfig = useMemo(() => [
    { key: 'daily', label: t('achievements.streakDisplay.daily'), icon: Calendar, color: 'from-orange-500 to-red-500', milestones: [7, 14, 30, 60, 100] },
    { key: 'weekly', label: t('achievements.streakDisplay.weekly'), icon: Flame, color: 'from-primary-500 to-primary-500', milestones: [4, 8, 12] },
    { key: 'monthly', label: t('achievements.streakDisplay.monthly'), icon: Award, color: 'from-primary-500 to-pink-500', milestones: [3, 6, 12] },
    { key: 'quarterly', label: t('achievements.streakDisplay.quarterly'), icon: Award, color: 'from-green-500 to-emerald-500', milestones: [2, 4] },
  ], [t]);
  const streaks = [
    { key: 'daily', value: dailyStreak },
    { key: 'weekly', value: weeklyStreak },
    { key: 'monthly', value: monthlyStreak },
    { key: 'quarterly', value: quarterlyStreak },
  ];

  const getNextMilestone = (current: number, milestones: number[]) => {
    return milestones.find(m => m > current) || milestones[milestones.length - 1];
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-500">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        {t('achievements.streakDisplay.title')}
      </h3>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {streakConfig.map((config, index) => {
          const streak = streaks.find(s => s.key === config.key);
          const value = streak?.value || 0;
          const nextMilestone = getNextMilestone(value, config.milestones);
          const Icon = config.icon;
          
          return (
            <motion.div
              key={config.key}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br ${config.color} mb-2`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
              
              <div className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatNumber(value)}
              </div>
              
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {config.label}
              </div>
              
              {value > 0 && nextMilestone && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  {t('achievements.streakDisplay.nextMilestone', { milestone: nextMilestone })}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
