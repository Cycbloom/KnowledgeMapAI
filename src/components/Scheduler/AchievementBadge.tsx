import React from 'react';
import { motion } from 'framer-motion';
import { Lock, Sparkles } from 'lucide-react';
import { Achievement } from '../../services/api/scheduler';

interface AchievementBadgeProps {
  achievement: Achievement;
  unlocked?: boolean;
  progress?: number;
  unlockedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  showProgress?: boolean;
  onClick?: () => void;
  animate?: boolean;
}

const SIZE_CONFIG = {
  sm: {
    container: 'w-16 h-16',
    icon: 'text-2xl',
    ring: 'w-20 h-20',
    glow: 'w-24 h-24',
  },
  md: {
    container: 'w-24 h-24',
    icon: 'text-4xl',
    ring: 'w-28 h-28',
    glow: 'w-32 h-32',
  },
  lg: {
    container: 'w-32 h-32',
    icon: 'text-5xl',
    ring: 'w-36 h-36',
    glow: 'w-40 h-40',
  },
};

const CATEGORY_COLORS = {
  focus: 'from-cyan-500 to-blue-500',
  tasks: 'from-emerald-500 to-teal-500',
  streak: 'from-amber-500 to-orange-500',
  special: 'from-violet-500 to-pink-500',
};

const CATEGORY_GLOW = {
  focus: 'shadow-cyan-500/50',
  tasks: 'shadow-emerald-500/50',
  streak: 'shadow-amber-500/50',
  special: 'shadow-violet-500/50',
};

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  unlocked = false,
  progress = 0,
  unlockedAt,
  size = 'md',
  showProgress = false,
  onClick,
  animate = true,
}) => {
  const sizeConfig = SIZE_CONFIG[size];
  const categoryGradient = CATEGORY_COLORS[achievement.category];
  const categoryGlow = CATEGORY_GLOW[achievement.category];

  const formatUnlockedDate = (date: string) => {
    return new Date(date).toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <motion.div
      className={`relative inline-flex flex-col items-center ${onClick ? 'cursor-pointer' : ''}`}
      onClick={onClick}
      whileHover={animate ? { scale: 1.05 } : undefined}
      whileTap={animate && onClick ? { scale: 0.95 } : undefined}
    >
      <div className={`relative ${sizeConfig.glow}`}>
        {unlocked && animate && (
          <motion.div
            className={`absolute inset-0 rounded-full bg-gradient-to-r ${categoryGradient} opacity-20 blur-xl ${categoryGlow}`}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        )}

        <motion.div
          className={`absolute inset-0 m-auto ${sizeConfig.ring} rounded-full border-2 ${
            unlocked 
              ? `border-gradient-to-r ${categoryGradient}` 
              : 'border-slate-300 dark:border-slate-600'
          }`}
          style={{
            borderImage: unlocked 
              ? `linear-gradient(135deg, ${achievement.color}, ${achievement.color}80)` 
              : undefined,
            borderImageSlice: 1,
          }}
          initial={animate ? { rotate: 0 } : undefined}
          animate={animate && unlocked ? { rotate: 360 } : undefined}
          transition={animate && unlocked ? { duration: 20, repeat: Infinity, ease: 'linear' } : undefined}
        />

        <div
          className={`
            relative ${sizeConfig.container} rounded-full flex items-center justify-center
            ${unlocked 
              ? `bg-gradient-to-br ${categoryGradient}` 
              : 'bg-slate-200 dark:bg-slate-700'
            }
            shadow-lg ${unlocked ? categoryGlow : ''}
          `}
        >
          {unlocked ? (
            <motion.span 
              className={sizeConfig.icon}
              initial={animate ? { scale: 0, rotate: -180 } : undefined}
              animate={animate ? { scale: 1, rotate: 0 } : undefined}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            >
              {achievement.icon}
            </motion.span>
          ) : (
            <Lock className={`${sizeConfig.icon} text-slate-400 dark:text-slate-500`} />
          )}

          {unlocked && achievement.xp_reward > 0 && (
            <motion.div
              initial={animate ? { scale: 0 } : undefined}
              animate={animate ? { scale: 1 } : undefined}
              transition={{ delay: 0.3 }}
              className="absolute -bottom-1 -right-1 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded-full shadow-md"
            >
              +{achievement.xp_reward} XP
            </motion.div>
          )}
        </div>

        {showProgress && !unlocked && progress > 0 && (
          <svg className={`absolute inset-0 m-auto ${sizeConfig.ring}`} viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-slate-200 dark:text-slate-700"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="48"
              fill="none"
              stroke={achievement.color}
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={`${progress * 3.01} 301.59`}
              transform="rotate(-90 50 50)"
              initial={animate ? { strokeDasharray: '0 301.59' } : undefined}
              animate={animate ? { strokeDasharray: `${progress * 3.01} 301.59` } : undefined}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </svg>
        )}
      </div>

      <div className="mt-2 text-center">
        <p
          className={`
            text-sm font-medium
            ${unlocked ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}
          `}
        >
          {unlocked ? achievement.name : '???'}
        </p>
        {unlocked && unlockedAt && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
            {formatUnlockedDate(unlockedAt)}
          </p>
        )}
        {showProgress && !unlocked && progress > 0 && (
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            {progress}%
          </p>
        )}
      </div>
    </motion.div>
  );
};

interface AchievementBadgeNotificationProps {
  achievement: Achievement;
  onClose?: () => void;
}

export const AchievementBadgeNotification: React.FC<AchievementBadgeNotificationProps> = ({
  achievement,
  onClose,
}) => {
  const categoryGradient = CATEGORY_COLORS[achievement.category];

  return (
    <motion.div
      initial={{ scale: 0.5, opacity: 0, y: 50 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.5, opacity: 0, y: 50 }}
      className="relative flex flex-col items-center p-6 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700"
    >
      <motion.div
        className="absolute inset-0 rounded-2xl overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <motion.div
          className={`absolute inset-0 bg-gradient-to-r ${categoryGradient} opacity-10`}
          animate={{
            opacity: [0.1, 0.2, 0.1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
        className="relative"
      >
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
          <Sparkles className="w-8 h-8 text-white" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="relative mt-4 text-center"
      >
        <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">成就解锁!</p>
        <p className="text-xl font-bold text-slate-900 dark:text-white mt-1">{achievement.name}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">{achievement.description}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.6 }}
        className="relative mt-4 flex items-center gap-2 bg-amber-100 dark:bg-amber-500/20 px-4 py-2 rounded-full"
      >
        <span className="text-lg">{achievement.icon}</span>
        <span className="text-amber-700 dark:text-amber-300 font-bold">+{achievement.xp_reward} XP</span>
      </motion.div>

      {onClose && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onClose}
          className="relative mt-6 px-6 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
        >
          太棒了!
        </motion.button>
      )}
    </motion.div>
  );
};
