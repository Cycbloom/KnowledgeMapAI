import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Check, Clock, Zap, Target, ListTodo } from "lucide-react";
import { ScheduledTask } from "@shared/types";
import { useUnifiedTimer } from "../../hooks/scheduler";

interface ActiveTaskPanelProps {
  task: ScheduledTask;
  onPause: () => void;
  onComplete: () => void;
  timeSlice: number;
}

const QUEUE_CONFIG = {
  0: {
    icon: Zap,
    gradient: "from-cyan-500 to-blue-500",
    border: "border-cyan-400",
    glow: "shadow-cyan-500/20",
    bg: "bg-gradient-to-r from-cyan-50 to-blue-50 dark:from-cyan-500/10 dark:to-blue-500/10",
    accentColor: "text-cyan-600 dark:text-cyan-400",
    ringColor: "ring-cyan-500/30",
  },
  1: {
    icon: Target,
    gradient: "from-emerald-500 to-teal-500",
    border: "border-emerald-400",
    glow: "shadow-emerald-500/20",
    bg: "bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-500/10 dark:to-teal-500/10",
    accentColor: "text-emerald-600 dark:text-emerald-400",
    ringColor: "ring-emerald-500/30",
  },
  2: {
    icon: ListTodo,
    gradient: "from-amber-500 to-orange-500",
    border: "border-amber-400",
    glow: "shadow-amber-500/20",
    bg: "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-500/10 dark:to-orange-500/10",
    accentColor: "text-amber-600 dark:text-amber-400",
    ringColor: "ring-amber-500/30",
  },
};

export const ActiveTaskPanel: React.FC<ActiveTaskPanelProps> = ({
  task,
  onPause,
  onComplete,
  timeSlice: _timeSlice,
}) => {
  const config =
    QUEUE_CONFIG[task.queue_level as keyof typeof QUEUE_CONFIG] ||
    QUEUE_CONFIG[2];
  const IconComponent = config.icon;

  const {
    timeLeft,
    isActive,
    progress,
    pause,
    resume,
    complete,
  } = useUnifiedTimer();

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handlePauseResume = () => {
    if (isActive) {
      pause();
    } else {
      resume();
    }
    onPause();
  };

  const handleComplete = async () => {
    await complete();
    onComplete();
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`
          relative overflow-hidden rounded-2xl border-2 ${config.border} ${config.bg}
          shadow-lg ${config.glow} ring-2 ${config.ringColor}
          p-4 mb-4
        `}
      >
        <div
          className={`absolute top-0 left-0 h-1 bg-gradient-to-r ${config.gradient}`}
          style={{ width: `${Math.min(progress, 100)}%` }}
        />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${config.gradient} shadow-lg`}
            >
              <IconComponent size={24} className="text-white" />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {task.title}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${config.accentColor} bg-white/50 dark:bg-slate-800/50`}
                >
                  Q{task.queue_level}
                </span>
              </div>
              {task.description && (
                <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-2 mb-1">
                <Clock size={16} className={config.accentColor} />
                <span
                  className={`text-2xl font-mono font-bold ${config.accentColor}`}
                >
                  {formatTime(timeLeft)}
                </span>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                {isActive ? "专注中..." : "已暂停"}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handlePauseResume}
                className={`
                  p-3 rounded-xl transition-all
                  ${
                    isActive
                      ? "bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-500/30"
                      : "bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-500/30"
                  }
                `}
                title={isActive ? "暂停" : "继续"}
              >
                {isActive ? <Pause size={20} /> : <Play size={20} />}
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleComplete}
                className="p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                title="完成"
              >
                <Check size={20} />
              </motion.button>
            </div>
          </div>
        </div>

        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute -bottom-1 left-0 right-0 h-1 bg-slate-200 dark:bg-slate-700 overflow-hidden"
          >
            <motion.div
              className={`h-full bg-gradient-to-r ${config.gradient}`}
              initial={{ width: "0%" }}
              animate={{ width: `${Math.min(progress, 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
};
