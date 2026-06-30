import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, Star, Zap, Target, Clock } from "lucide-react";
import type { TimerMode } from "@shared/types";
import { formatDurationMinutes } from "../../utils/formatters";

interface StreakMilestone {
  minutes: number;
  label: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const STREAK_MILESTONES: StreakMilestone[] = [
  {
    minutes: 25,
    label: "专注达人",
    icon: <Star size={16} />,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  {
    minutes: 50,
    label: "持续专注",
    icon: <Zap size={16} />,
    color: "text-orange-400",
    bgColor: "bg-orange-500/20",
  },
  {
    minutes: 100,
    label: "深度专注",
    icon: <Target size={16} />,
    color: "text-primary-400",
    bgColor: "bg-primary-500/20",
  },
  {
    minutes: 150,
    label: "超级专注",
    icon: <Trophy size={16} />,
    color: "text-primary-400",
    bgColor: "bg-primary-500/20",
  },
  {
    minutes: 200,
    label: "传奇专注",
    icon: <Flame size={16} />,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
];

interface FocusStreakProps {
  totalMinutes: number;
  pomodorosCompleted: number;
  currentStreakMinutes: number;
  isActivelyFocusing?: boolean;
  timerMode?: TimerMode;
  showAnimation?: boolean;
}

export const FocusStreak: React.FC<FocusStreakProps> = ({
  totalMinutes,
  pomodorosCompleted,
  currentStreakMinutes,
  isActivelyFocusing = false,
  timerMode = "focus",
  showAnimation = true,
}) => {
  const [displayMinutes, setDisplayMinutes] = useState(totalMinutes);
  const [showMilestone, setShowMilestone] = useState<StreakMilestone | null>(
    null,
  );
  const [prevMinutes, setPrevMinutes] = useState(totalMinutes);

  useEffect(() => {
    if (totalMinutes !== prevMinutes) {
      const milestone = STREAK_MILESTONES.find(
        (m) => prevMinutes < m.minutes && totalMinutes >= m.minutes,
      );

      if (milestone && showAnimation) {
        setShowMilestone(milestone);
        setTimeout(() => setShowMilestone(null), 3000);
      }

      setPrevMinutes(totalMinutes);
    }
    setDisplayMinutes(totalMinutes);
  }, [totalMinutes, prevMinutes, showAnimation]);

  const getCurrentMilestone = () => {
    for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
      if (displayMinutes >= STREAK_MILESTONES[i].minutes) {
        return STREAK_MILESTONES[i];
      }
    }
    return null;
  };

  const getNextMilestone = () => {
    return STREAK_MILESTONES.find((m) => displayMinutes < m.minutes);
  };

  const currentMilestone = getCurrentMilestone();
  const nextMilestone = getNextMilestone();
  const progressToNext = nextMilestone
    ? ((displayMinutes - (currentMilestone?.minutes || 0)) /
        (nextMilestone.minutes - (currentMilestone?.minutes || 0))) *
      100
    : 100;

  return (
    <div className="relative">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 rounded-xl bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-slate-700/50 backdrop-blur-sm"
      >
        <div className="flex items-center gap-4 mb-4">
          <motion.div
            className={`relative p-3 rounded-xl ${currentMilestone?.bgColor || "bg-slate-700/50"}`}
            animate={
              isActivelyFocusing
                ? {
                    boxShadow: [
                      `0 0 0px ${currentMilestone?.color.replace("text-", "rgba(") || "rgba(100,100,100"} , 0)`,
                      `0 0 20px ${currentMilestone?.color.replace("text-", "rgba(") || "rgba(100,100,100"} , 0.3)`,
                      `0 0 0px ${currentMilestone?.color.replace("text-", "rgba(") || "rgba(100,100,100"} , 0)`,
                    ],
                  }
                : {}
            }
            transition={{ duration: 2, repeat: Infinity }}
          >
            {currentMilestone?.icon || (
              <Flame size={20} className="text-slate-400" />
            )}
            {currentMilestone && (
              <span
                className={`absolute -top-1 -right-1 text-xs ${currentMilestone.color}`}
              >
                ★
              </span>
            )}
          </motion.div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl font-bold text-white">
                {formatDurationMinutes(displayMinutes, { emptyText: '0分钟' })}
              </span>
              {isActivelyFocusing && (
                <motion.span
                  animate={{ opacity: [1, 0.5, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="text-xs text-primary-400"
                >
                  {timerMode === "focus" ? "专注中" : "休息中"}
                </motion.span>
              )}
            </div>
            <div className="text-sm text-slate-400">
              {currentMilestone ? (
                <span className={currentMilestone.color}>
                  {currentMilestone.label}
                </span>
              ) : (
                <span>开始你的专注之旅</span>
              )}
            </div>
          </div>
        </div>

        {nextMilestone && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>下一个里程碑: {nextMilestone.label}</span>
              <span>{nextMilestone.minutes}分钟</span>
            </div>
            <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${nextMilestone.bgColor.replace("bg-", "bg-").replace("/20", "")}`}
                initial={{ width: 0 }}
                animate={{ width: `${progressToNext}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                  background: `linear-gradient(90deg, ${nextMilestone.color.replace("text-", "")} 0%, ${nextMilestone.color.replace("text-", "")}80 100%)`,
                }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/30">
            <Clock size={14} className="text-primary-400" />
            <div>
              <div className="text-xs text-slate-400">当前连续</div>
              <div className="text-sm font-medium text-white">
                {currentStreakMinutes}分钟
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-700/30">
            <Trophy size={14} className="text-amber-400" />
            <div>
              <div className="text-xs text-slate-400">番茄钟</div>
              <div className="text-sm font-medium text-white">
                {pomodorosCompleted}个
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-700/50">
          <span className="text-xs text-slate-500">里程碑:</span>
          <div className="flex items-center gap-1">
            {STREAK_MILESTONES.map((milestone, index) => (
              <motion.div
                key={milestone.minutes}
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${
                  displayMinutes >= milestone.minutes
                    ? milestone.bgColor
                    : "bg-slate-700/30"
                }`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: index * 0.1 }}
                title={milestone.label}
              >
                <span
                  className={
                    displayMinutes >= milestone.minutes
                      ? milestone.color
                      : "text-slate-500"
                  }
                >
                  {index + 1}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showMilestone && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.5, y: -20 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 z-10"
          >
            <div
              className={`px-4 py-2 rounded-full ${showMilestone.bgColor} border border-${showMilestone.color.replace("text-", "")}/30 shadow-lg`}
            >
              <div className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 0.5, repeat: 2 }}
                  className={showMilestone.color}
                >
                  {showMilestone.icon}
                </motion.span>
                <span className={`font-medium ${showMilestone.color}`}>
                  🎉 {showMilestone.label}!
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isActivelyFocusing && (
        <motion.div
          className="absolute -inset-1 rounded-xl pointer-events-none"
          animate={{
            boxShadow: [
              "0 0 0px rgba(6, 182, 212, 0)",
              "0 0 10px rgba(6, 182, 212, 0.3)",
              "0 0 0px rgba(6, 182, 212, 0)",
            ],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      )}
    </div>
  );
};

interface MiniStreakProps {
  streakMinutes: number;
  pomodorosCompleted: number;
}

export const MiniStreak: React.FC<MiniStreakProps> = ({
  streakMinutes,
  pomodorosCompleted,
}) => {
  const getMilestone = () => {
    for (let i = STREAK_MILESTONES.length - 1; i >= 0; i--) {
      if (streakMinutes >= STREAK_MILESTONES[i].minutes) {
        return STREAK_MILESTONES[i];
      }
    }
    return null;
  };

  const milestone = getMilestone();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700/50"
    >
      <motion.div
        className={`${milestone?.color || "text-slate-400"}`}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Flame size={14} />
      </motion.div>
      <span className="text-xs font-medium text-white">
        {streakMinutes}分钟
      </span>
      <span className="text-xs text-slate-500">|</span>
      <span className="text-xs text-slate-400">{pomodorosCompleted}🍅</span>
    </motion.div>
  );
};
