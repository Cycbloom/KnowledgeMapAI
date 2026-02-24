import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles } from 'lucide-react';
import { Achievement } from '../../services/api/scheduler';

interface AchievementNotification {
  id: string;
  achievement: Achievement;
  timestamp: Date;
}

interface AchievementNotificationContextType {
  showNotification: (achievement: Achievement) => void;
  showMultipleNotifications: (achievements: Achievement[]) => void;
  clearNotifications: () => void;
}

const AchievementNotificationContext = createContext<AchievementNotificationContextType | null>(null);

export const useAchievementNotification = () => {
  const context = useContext(AchievementNotificationContext);
  if (!context) {
    throw new Error('useAchievementNotification must be used within AchievementNotificationProvider');
  }
  return context;
};

interface AchievementNotificationProviderProps {
  children: React.ReactNode;
  maxVisible?: number;
  autoDismissMs?: number;
}

const CATEGORY_COLORS = {
  focus: 'from-cyan-500 to-blue-500',
  tasks: 'from-emerald-500 to-teal-500',
  streak: 'from-amber-500 to-orange-500',
  special: 'from-violet-500 to-pink-500',
};

const SingleNotification: React.FC<{
  notification: AchievementNotification;
  onDismiss: (id: string) => void;
}> = ({ notification, onDismiss }) => {
  const gradient = CATEGORY_COLORS[notification.achievement.category];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 100, scale: 0.8 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 100, scale: 0.8 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      className="relative overflow-hidden bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm"
    >
      <div className={`absolute inset-0 bg-gradient-to-r ${gradient} opacity-5`} />
      
      <div className="relative p-4">
        <button
          onClick={() => onDismiss(notification.id)}
          className="absolute top-2 right-2 p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={16} />
        </button>

        <div className="flex items-start gap-3">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.1 }}
            className="flex-shrink-0 w-12 h-12 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg"
          >
            <Sparkles size={20} className="text-white" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                成就解锁!
              </p>
              <p className="text-base font-bold text-slate-900 dark:text-white truncate">
                {notification.achievement.name}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                {notification.achievement.description}
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center gap-2 mt-2"
            >
              <span className="text-lg">{notification.achievement.icon}</span>
              <span className="text-sm font-bold text-amber-600 dark:text-amber-400">
                +{notification.achievement.xp_reward} XP
              </span>
            </motion.div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ scaleX: 1 }}
        animate={{ scaleX: 0 }}
        transition={{ duration: 5, ease: 'linear' }}
        className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient} origin-left`}
      />
    </motion.div>
  );
};

export const AchievementNotificationProvider: React.FC<AchievementNotificationProviderProps> = ({
  children,
  maxVisible = 3,
  autoDismissMs = 5000,
}) => {
  const [notifications, setNotifications] = useState<AchievementNotification[]>([]);

  const showNotification = useCallback((achievement: Achievement) => {
    const notification: AchievementNotification = {
      id: `${achievement.id}-${Date.now()}`,
      achievement,
      timestamp: new Date(),
    };

    setNotifications((prev) => {
      const newNotifications = [...prev, notification];
      return newNotifications.slice(-maxVisible);
    });
  }, [maxVisible]);

  const showMultipleNotifications = useCallback((achievements: Achievement[]) => {
    achievements.forEach((achievement, index) => {
      setTimeout(() => {
        showNotification(achievement);
      }, index * 500);
    });
  }, [showNotification]);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  useEffect(() => {
    if (notifications.length > 0 && autoDismissMs > 0) {
      const timer = setTimeout(() => {
        setNotifications((prev) => prev.slice(1));
      }, autoDismissMs);

      return () => clearTimeout(timer);
    }
  }, [notifications, autoDismissMs]);

  return (
    <AchievementNotificationContext.Provider
      value={{ showNotification, showMultipleNotifications, clearNotifications }}
    >
      {children}
      
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {notifications.map((notification) => (
            <div key={notification.id} className="pointer-events-auto">
              <SingleNotification
                notification={notification}
                onDismiss={dismissNotification}
              />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </AchievementNotificationContext.Provider>
  );
};

interface AchievementUnlockModalProps {
  achievements: Achievement[];
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementUnlockModal: React.FC<AchievementUnlockModalProps> = ({
  achievements,
  isOpen,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(0);
    }
  }, [isOpen]);

  const currentAchievement = achievements[currentIndex];
  const hasNext = currentIndex < achievements.length - 1;
  const hasPrev = currentIndex > 0;

  if (!currentAchievement) return null;

  const gradient = CATEGORY_COLORS[currentAchievement.category];

  const handleNext = () => {
    if (hasNext) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handlePrev = () => {
    if (hasPrev) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="relative bg-white dark:bg-slate-800 rounded-2xl p-8 max-w-md w-full shadow-2xl overflow-hidden"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-5`} />

            <div className="relative">
              {achievements.length > 1 && (
                <div className="absolute top-0 left-0 right-0 flex justify-center gap-1 mb-4">
                  {achievements.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-all ${
                        index === currentIndex
                          ? 'bg-amber-500 w-4'
                          : 'bg-slate-300 dark:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>
              )}

              <motion.div
                key={currentAchievement.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-amber-400 to-amber-500 flex items-center justify-center shadow-lg shadow-amber-500/30 mb-4"
                >
                  <Sparkles className="w-10 h-10 text-white" />
                </motion.div>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="text-sm text-amber-600 dark:text-amber-400 font-medium"
                >
                  成就解锁!
                </motion.p>

                <motion.h3
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-2xl font-bold text-slate-900 dark:text-white mt-2"
                >
                  {currentAchievement.name}
                </motion.h3>

                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-slate-500 dark:text-slate-400 mt-2"
                >
                  {currentAchievement.description}
                </motion.p>

                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.5 }}
                  className="flex items-center justify-center gap-3 mt-4"
                >
                  <span className="text-3xl">{currentAchievement.icon}</span>
                  <span className="text-xl font-bold text-amber-600 dark:text-amber-400">
                    +{currentAchievement.xp_reward} XP
                  </span>
                </motion.div>
              </motion.div>

              <div className="flex items-center justify-center gap-3 mt-6">
                {hasPrev && (
                  <button
                    onClick={handlePrev}
                    className="px-4 py-2 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg font-medium transition-colors"
                  >
                    上一个
                  </button>
                )}

                {hasNext ? (
                  <button
                    onClick={handleNext}
                    className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-medium transition-all"
                  >
                    下一个
                  </button>
                ) : (
                  <button
                    onClick={onClose}
                    className="px-6 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-medium transition-all"
                  >
                    太棒了!
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
