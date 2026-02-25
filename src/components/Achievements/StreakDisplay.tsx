import React from 'react';
import { motion } from 'framer-motion';
import { Flame, Calendar, Award } from 'lucide-react';

interface StreakDisplayProps {
  dailyStreak: number;
  weeklyStreak: number;
  monthlyStreak: number;
  quarterlyStreak: number;
}

const streakConfig = [
  { key: 'daily', label: '每日任务', icon: Calendar, color: 'from-orange-500 to-red-500', milestones: [7, 14, 30, 60, 100] },
  { key: 'weekly', label: '周任务', icon: Flame, color: 'from-blue-500 to-cyan-500', milestones: [4, 8, 12] },
  { key: 'monthly', label: '月任务', icon: Award, color: 'from-purple-500 to-pink-500', milestones: [3, 6, 12] },
  { key: 'quarterly', label: '季度任务', icon: Award, color: 'from-green-500 to-emerald-500', milestones: [2, 4] },
];

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  dailyStreak,
  weeklyStreak,
  monthlyStreak,
  quarterlyStreak,
}) => {
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
    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
      <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
        <Flame className="w-5 h-5 text-orange-500" />
        连续完成记录
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
                {value}
              </div>
              
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                {config.label}连续
              </div>
              
              {value > 0 && nextMilestone && (
                <div className="text-xs text-amber-600 dark:text-amber-400">
                  下个里程碑: {nextMilestone}
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};
