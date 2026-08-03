import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  useId,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Play,
  Pause,
  Check,
  SkipForward,
  Coffee,
  Volume2,
  VolumeX,
  Bell,
  BellOff,
  Clock,
  Calendar,
  Tag,
  ArrowLeft,
  Zap,
  Target,
  AlertCircle,
} from "lucide-react";
import {
  useSchedulerTasks,
  useSchedulerSettings,
  usePauseUserTaskMutation,
  useCompleteUserTaskMutation,
  useDemoteUserTaskMutation,
  useStartUserTaskMutation,
} from "../hooks";
import { Skeleton } from "../components/common";
import { message } from "../utils/messageHelper";
import { formatDurationMinutes, formatTimeFromSeconds, formatDate } from "../utils/formatters";
import { useTimerStore } from "../store/useTimerStore";
import type { UserTask, TaskSettings } from "@shared/types";
import { useFocusTrap, useEscapeKey } from "@/hooks/common";

interface QueueConfig {
  name: string;
  color: string;
  gradient: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  glowColor: string;
}

const QUEUE_VISUAL_CONFIG: Record<number, Omit<QueueConfig, "name">> = {
  0: {
    color: "#06b6d4",
    gradient: "from-primary-400 to-primary-500",
    bgClass: "bg-primary-100 dark:bg-primary-500/10",
    textClass: "text-primary-600 dark:text-primary-400",
    borderClass: "border-primary-200 dark:border-primary-500/30",
    glowColor: "rgba(6, 182, 212, 0.4)",
  },
  1: {
    color: "#10b981",
    gradient: "from-emerald-400 to-green-500",
    bgClass: "bg-emerald-100 dark:bg-emerald-500/10",
    textClass: "text-emerald-600 dark:text-emerald-400",
    borderClass: "border-emerald-200 dark:border-emerald-500/30",
    glowColor: "rgba(16, 185, 129, 0.4)",
  },
  2: {
    color: "#f59e0b",
    gradient: "from-amber-400 to-orange-500",
    bgClass: "bg-amber-100 dark:bg-amber-500/10",
    textClass: "text-amber-600 dark:text-amber-400",
    borderClass: "border-amber-200 dark:border-amber-500/30",
    glowColor: "rgba(245, 158, 11, 0.4)",
  },
};

const getTimeSlice = (
  queueLevel: number,
  settings: TaskSettings | undefined,
): number => {
  if (!settings) return 25 * 60;
  switch (queueLevel) {
    case 0:
      return (settings.q0_time_slice || 15) * 60;
    case 1:
      return (settings.q1_time_slice || 25) * 60;
    case 2:
      return (settings.q2_time_slice || 45) * 60;
    default:
      return 25 * 60;
  }
};

export const CurrentTask: React.FC = () => {
  const { t } = useTranslation();
  const timeUpTitleId = useId();
  const {
    data: tasksData,
    isLoading,
    refetch,
  } = useSchedulerTasks({ status: "in_progress" });
  const { data: settings } = useSchedulerSettings();
  const pauseMutation = usePauseUserTaskMutation();
  const completeMutation = useCompleteUserTaskMutation();
  const demoteMutation = useDemoteUserTaskMutation();
  const startMutation = useStartUserTaskMutation();

  const currentTask = useMemo(() => {
    const tasks = tasksData as UserTask[] | undefined;
    return tasks?.[0] || null;
  }, [tasksData]);

  const timerTaskId = useTimerStore((s) => s.taskId);
  const timerMode = useTimerStore((s) => s.mode);
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const totalTime = useTimerStore((s) => s.totalTime);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const timerProgress = useTimerStore((s) => s.progress);
  const startTimer = useTimerStore((s) => s.start);
  const pauseTimer = useTimerStore((s) => s.pause);
  const resumeTimer = useTimerStore((s) => s.resume);
  const completeTimer = useTimerStore((s) => s.complete);
  const skipToNext = useTimerStore((s) => s.skipToNext);

  const [soundEnabled, setSoundEnabled] = useState(
    settings?.sound_enabled ?? true,
  );
  const [notificationEnabled, setNotificationEnabled] = useState(
    settings?.notification_enabled ?? true,
  );
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [glowOffset, setGlowOffset] = useState(0);

  const timeUpModalRef = useFocusTrap<HTMLDivElement>({ enabled: showTimeUpModal });
  useEscapeKey(() => setShowTimeUpModal(false), showTimeUpModal);

  const glowAnimationRef = useRef<number | null>(null);

  const getQueueConfig = useCallback((queueLevel: number): QueueConfig => {
    const visual = QUEUE_VISUAL_CONFIG[queueLevel] || QUEUE_VISUAL_CONFIG[0];
    const nameMap: Record<number, string> = {
      0: t("scheduler.currentTask.queueUrgent"),
      1: t("scheduler.currentTask.queueImportant"),
      2: t("scheduler.currentTask.queueNormal"),
    };
    return { ...visual, name: nameMap[queueLevel] || nameMap[0] };
  }, [t]);

  const queueConfig = currentTask
    ? getQueueConfig(currentTask.queue_level as number)
    : getQueueConfig(0);
  const timeSliceMinutes = currentTask
    ? getTimeSlice(currentTask.queue_level, settings) / 60
    : 25;
  const breakDurationMinutes = settings?.break_duration || 5;

  const isBreak = timerMode !== "focus";
  const remaining = timeLeft;
  const progress = timerProgress / 100;

  const requestNotificationPermission = useCallback(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  useEffect(() => {
    if (isActive) {
      const animateGlow = () => {
        setGlowOffset(Math.sin(Date.now() / 500) * 15);
        glowAnimationRef.current = requestAnimationFrame(animateGlow);
      };
      glowAnimationRef.current = requestAnimationFrame(animateGlow);
      return () => {
        if (glowAnimationRef.current) {
          cancelAnimationFrame(glowAnimationRef.current);
        }
      };
    }
  }, [isActive]);

  useEffect(() => {
    if (currentTask && currentTask.status === "in_progress" && !timerTaskId) {
      startTimer(currentTask.id, timeSliceMinutes, currentTask.queue_level);
    }
  }, [currentTask, timerTaskId, timeSliceMinutes, startTimer]);

  useEffect(() => {
    if (!isActive && timerTaskId && timeLeft === 0) {
      setShowTimeUpModal(true);
    }
  }, [isActive, timerTaskId, timeLeft]);

  const handlePause = async () => {
    if (!currentTask) return;
    try {
      await pauseMutation.mutateAsync(currentTask.id);
      pauseTimer();
      message.info(t("scheduler.currentTask.taskPaused"));
    } catch (_error) {
      message.error(t("scheduler.currentTask.pauseFailed"));
    }
  };

  const handleResume = async () => {
    if (!currentTask) return;
    try {
      await startMutation.mutateAsync(currentTask.id);
      resumeTimer();
      message.success(t("scheduler.currentTask.taskResumed"));
    } catch (_error) {
      message.error(t("scheduler.currentTask.resumeFailed"));
    }
  };

  const handleComplete = async () => {
    if (!currentTask) return;
    try {
      await completeMutation.mutateAsync(currentTask.id);
      await completeTimer();
      message.success(t("scheduler.currentTask.taskCompleted"));
      refetch();
    } catch (_error) {
      message.error(t("scheduler.currentTask.completeFailed"));
    }
  };

  const handleSkip = async () => {
    if (!currentTask) return;
    try {
      await demoteMutation.mutateAsync(currentTask.id);
      await completeTimer();
      message.info(t("scheduler.currentTask.taskDemoted"));
      refetch();
    } catch (_error) {
      message.error(t("scheduler.currentTask.demoteFailed"));
    }
  };

  const handleStartBreak = () => {
    skipToNext();
    setShowTimeUpModal(false);
  };

  const handleContinueWork = () => {
    if (currentTask) {
      startTimer(currentTask.id, timeSliceMinutes, currentTask.queue_level);
    }
    setShowTimeUpModal(false);
  };

  const handleDismissModal = () => {
    setShowTimeUpModal(false);
  };

  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);

  const progressColor = isBreak
    ? "#10B981"
    : progress < 0.5
      ? queueConfig.color
      : progress < 0.8
        ? "#f59e0b"
        : "#ef4444";

  if (isLoading) {
    return (
      <div className="h-full bg-slate-50 dark:bg-slate-900 p-6 lg:p-8">
        <h1 className="sr-only">{t("unifiedWorkbench.labels.currentTask")}</h1>
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-32 w-full mb-6 rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <h1 className="sr-only">{t("unifiedWorkbench.labels.currentTask")}</h1>
        <div className="text-center max-w-md px-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6"
          >
            <Coffee size={40} className="text-slate-400 dark:text-slate-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">
            {t("scheduler.currentTask.noActiveTask")}
          </h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            {t("scheduler.currentTask.noActiveTaskDesc")}
          </p>
          <Link
            to="/scheduler"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Target size={18} />
            {t("scheduler.currentTask.goToTaskQueue")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 lg:p-8">
      <h1 className="sr-only">{t("unifiedWorkbench.labels.currentTask")}</h1>
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/scheduler"
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>{t("scheduler.currentTask.backToTaskQueue")}</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled
                  ? "bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              }`}
              title={soundEnabled ? t("scheduler.currentTask.soundOn") : t("scheduler.currentTask.soundOff")}
              aria-label={soundEnabled ? t("scheduler.currentTask.soundOn") : t("scheduler.currentTask.soundOff")}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => setNotificationEnabled(!notificationEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                notificationEnabled
                  ? "bg-slate-100 dark:bg-slate-800 text-primary-600 dark:text-primary-400"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500"
              }`}
              title={notificationEnabled ? t("scheduler.currentTask.notificationOn") : t("scheduler.currentTask.notificationOff")}
              aria-label={notificationEnabled ? t("scheduler.currentTask.notificationOn") : t("scheduler.currentTask.notificationOff")}
            >
              {notificationEnabled ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center"
          >
            <div className="relative w-80 h-80">
              <svg
                className="w-full h-full transform -rotate-90"
                viewBox="0 0 300 300"
                aria-hidden="true"
              >
                <defs>
                  <filter
                    id="glow-large"
                    x="-50%"
                    y="-50%"
                    width="200%"
                    height="200%"
                  >
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient
                    id="progress-gradient"
                    x1="0%"
                    y1="0%"
                    x2="100%"
                    y2="100%"
                  >
                    <stop offset="0%" stopColor={progressColor} />
                    <stop
                      offset="100%"
                      stopColor={progressColor}
                      stopOpacity="0.6"
                    />
                  </linearGradient>
                </defs>

                <circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.2)"
                  className="dark:[stroke:rgba(30,41,59,0.8)]"
                  strokeWidth="12"
                />

                <motion.circle
                  cx="150"
                  cy="150"
                  r="140"
                  fill="none"
                  stroke="url(#progress-gradient)"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  filter="url(#glow-large)"
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />

                <circle
                  cx="150"
                  cy="150"
                  r="120"
                  fill="none"
                  stroke="rgba(148, 163, 184, 0.15)"
                  className="dark:[stroke:rgba(51,65,85,0.3)]"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              </svg>

              <div className="absolute inset-0 flex flex-col items-center justify-center">
                {isBreak && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="mb-2"
                  >
                    <Coffee
                      size={28}
                      className="text-emerald-500 dark:text-emerald-400"
                    />
                  </motion.div>
                )}

                <motion.div
                  className="text-6xl font-mono font-bold tracking-wider"
                  style={{ color: progressColor }}
                  key={formatTimeFromSeconds(remaining)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {formatTimeFromSeconds(remaining)}
                </motion.div>

                <div className="text-sm text-slate-500 dark:text-slate-500 mt-2">
                  {isBreak ? t("scheduler.currentTask.breakTime") : t("scheduler.currentTask.focusTime")}
                </div>

                <div
                  className="text-sm text-slate-400 dark:text-slate-600 mt-1"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {Math.round(progress * 100)}%
                </div>
              </div>

              {isActive && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{
                    boxShadow: `0 0 ${30 + glowOffset}px ${progressColor}40`,
                  }}
                  animate={{
                    opacity: [0.5, 0.8, 0.5],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-4 mt-8">
              {isActive && !isPaused ? (
                <motion.button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Pause size={20} />
                  <span className="font-medium">{t("scheduler.currentTask.pause")}</span>
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-primary-100 dark:bg-primary-500/20 text-primary-600 dark:text-primary-400 border border-primary-200 dark:border-primary-500/30 hover:bg-primary-200 dark:hover:bg-primary-500/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play size={20} />
                  <span className="font-medium">{t("scheduler.currentTask.resume")}</span>
                </motion.button>
              )}

              <motion.button
                onClick={handleComplete}
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Check size={20} />
                <span className="font-medium">{t("scheduler.currentTask.complete")}</span>
              </motion.button>
            </div>

            <div className="mt-4 flex items-center gap-6 text-sm text-slate-400 dark:text-slate-500">
              <div
                className="flex items-center gap-2"
                aria-live="polite"
                aria-atomic="true"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: queueConfig.color }}
                />
                <span>{t("scheduler.currentTask.used")}: {formatTimeFromSeconds(totalTime - timeLeft)}</span>
              </div>
              <div
                className="flex items-center gap-2"
                aria-live="polite"
                aria-atomic="true"
              >
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-400" />
                <span>{t("scheduler.currentTask.total")}: {formatTimeFromSeconds(totalTime)}</span>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div
              className={`rounded-2xl border p-6 ${queueConfig.bgClass} ${queueConfig.borderClass}`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className={`p-3 rounded-xl bg-gradient-to-br ${queueConfig.gradient}`}
                >
                  <Zap size={24} className="text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${queueConfig.bgClass} ${queueConfig.textClass}`}
                    >
                      Q{currentTask.queue_level}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">
                      {queueConfig.name}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {currentTask.title}
                  </h2>
                </div>
              </div>

              {currentTask.description && (
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">
                  {currentTask.description}
                </p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 dark:text-slate-500">
                {currentTask.estimated_duration && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={queueConfig.textClass} />
                    <span>
                      {t("scheduler.currentTask.estimated")} {formatDurationMinutes(currentTask.estimated_duration)}
                    </span>
                  </div>
                )}

                {currentTask.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar
                      size={14}
                      className="text-red-500 dark:text-red-400"
                    />
                    <span className="text-red-500 dark:text-red-400">
                      {t("scheduler.currentTask.deadline")} {formatDate(currentTask.deadline, 'short')}
                    </span>
                  </div>
                )}

                {currentTask.tags && currentTask.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag
                      size={14}
                      className="text-primary-500 dark:text-primary-400"
                    />
                    <span className="text-primary-500 dark:text-primary-400">
                      {currentTask.tags.join(", ")}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800/50 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {t("scheduler.currentTask.optionsTitle")}
              </h3>
              <div className="space-y-3">
                <motion.button
                  onClick={handleSkip}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <SkipForward
                    size={18}
                    className="text-amber-500 dark:text-amber-400"
                  />
                  <div className="text-left">
                    <div className="font-medium">{t("scheduler.currentTask.skipTask")}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-500">
                      {t("scheduler.currentTask.skipTaskDesc")}
                    </div>
                  </div>
                </motion.button>

                <motion.button
                  onClick={handleStartBreak}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <Coffee
                    size={18}
                    className="text-emerald-500 dark:text-emerald-400"
                  />
                  <div className="text-left">
                    <div className="font-medium">{t("scheduler.currentTask.startBreak")}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-500">
                      {t("scheduler.currentTask.breakMinutes", { count: breakDurationMinutes })}
                    </div>
                  </div>
                </motion.button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-500 bg-white dark:bg-slate-800/50 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                {t("scheduler.currentTask.timeSliceSettings")}
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-xl bg-primary-100 dark:bg-primary-500/10 border border-primary-200 dark:border-primary-500/20">
                  <div className="text-xs text-primary-600 dark:text-primary-400 mb-1">
                    {t("scheduler.currentTask.q0Urgent")}
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {settings?.q0_time_slice || 15}{t("scheduler.currentTask.minutesSuffix")}
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">
                    {t("scheduler.currentTask.q1Important")}
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {settings?.q1_time_slice || 25}{t("scheduler.currentTask.minutesSuffix")}
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">
                    {t("scheduler.currentTask.q2Normal")}
                  </div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {settings?.q2_time_slice || 45}{t("scheduler.currentTask.minutesSuffix")}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        <AnimatePresence>
          {showTimeUpModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 dark:bg-black/70 backdrop-blur-sm"
            >
              <motion.div
                ref={timeUpModalRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={timeUpTitleId}
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-500 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-500/20">
                    <AlertCircle
                      size={24}
                      className="text-amber-500 dark:text-amber-400"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {isBreak ? t("scheduler.currentTask.breakEnded") : t("scheduler.currentTask.timeSliceEnded")}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {isBreak ? t("scheduler.currentTask.breakEndedDesc") : t("scheduler.currentTask.timeSliceEndedDesc")}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  {isBreak ? (
                    <>
                      <motion.button
                        onClick={handleContinueWork}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-primary-500 to-primary-500 text-white font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {t("scheduler.currentTask.continueWork")}
                      </motion.button>
                      <motion.button
                        onClick={handleDismissModal}
                        className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {t("scheduler.currentTask.dealWithLater")}
                      </motion.button>
                    </>
                  ) : (
                    <>
                      <motion.button
                        onClick={handleStartBreak}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-green-500 text-white font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {t("scheduler.currentTask.startBreak")}
                      </motion.button>
                      <motion.button
                        onClick={handleContinueWork}
                        className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {t("scheduler.currentTask.continueWork")}
                      </motion.button>
                      <motion.button
                        onClick={handleComplete}
                        className="w-full py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-emerald-600 dark:text-emerald-400 font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        {t("scheduler.currentTask.markComplete")}
                      </motion.button>
                    </>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CurrentTask;
