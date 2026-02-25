import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
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
} from 'lucide-react';
import {
  useSchedulerTasks,
  useSchedulerSettings,
  usePauseTaskMutation,
  useCompleteTaskMutation,
  useDemoteTaskMutation,
  useStartTaskMutation,
} from '../hooks/useScheduler';
import { useMessageStore } from '../store/useMessageStore';
import type { ScheduledTask, TaskSettings } from '../services/api/scheduler';

const QUEUE_CONFIG = {
  0: {
    name: '紧急队列',
    color: '#06b6d4',
    gradient: 'from-cyan-400 to-blue-500',
    bgClass: 'bg-cyan-100 dark:bg-cyan-500/10',
    textClass: 'text-cyan-600 dark:text-cyan-400',
    borderClass: 'border-cyan-200 dark:border-cyan-500/30',
    glowColor: 'rgba(6, 182, 212, 0.4)',
  },
  1: {
    name: '重要队列',
    color: '#10b981',
    gradient: 'from-emerald-400 to-green-500',
    bgClass: 'bg-emerald-100 dark:bg-emerald-500/10',
    textClass: 'text-emerald-600 dark:text-emerald-400',
    borderClass: 'border-emerald-200 dark:border-emerald-500/30',
    glowColor: 'rgba(16, 185, 129, 0.4)',
  },
  2: {
    name: '普通队列',
    color: '#f59e0b',
    gradient: 'from-amber-400 to-orange-500',
    bgClass: 'bg-amber-100 dark:bg-amber-500/10',
    textClass: 'text-amber-600 dark:text-amber-400',
    borderClass: 'border-amber-200 dark:border-amber-500/30',
    glowColor: 'rgba(245, 158, 11, 0.4)',
  },
};

const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const formatDuration = (minutes?: number): string => {
  if (!minutes) return '--';
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分钟` : `${hours}小时`;
};

const getTimeSlice = (queueLevel: number, settings: TaskSettings | undefined): number => {
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
  const { data: tasksData, isLoading, refetch } = useSchedulerTasks({ status: 'in_progress' });
  const { data: settings } = useSchedulerSettings();
  const pauseMutation = usePauseTaskMutation();
  const completeMutation = useCompleteTaskMutation();
  const demoteMutation = useDemoteTaskMutation();
  const startMutation = useStartTaskMutation();
  const { addMessage } = useMessageStore();

  const currentTask = useMemo(() => {
    const tasks = tasksData as ScheduledTask[] | undefined;
    return tasks?.[0] || null;
  }, [tasksData]);

  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [breakElapsed, setBreakElapsed] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(settings?.sound_enabled ?? true);
  const [notificationEnabled, setNotificationEnabled] = useState(settings?.notification_enabled ?? true);
  const [showTimeUpModal, setShowTimeUpModal] = useState(false);
  const [glowOffset, setGlowOffset] = useState(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const glowAnimationRef = useRef<number | null>(null);

  const queueConfig = currentTask ? QUEUE_CONFIG[currentTask.queue_level as keyof typeof QUEUE_CONFIG] : QUEUE_CONFIG[0];
  const timeSlice = currentTask ? getTimeSlice(currentTask.queue_level, settings) : 25 * 60;
  const breakDuration = (settings?.break_duration || 5) * 60;

  const remaining = isBreak ? breakDuration - breakElapsed : timeSlice - elapsed;
  const progress = isBreak
    ? breakElapsed / breakDuration
    : elapsed / timeSlice;

  const playNotificationSound = useCallback(() => {
    if (!soundEnabled) return;

    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.setValueAtTime(800, ctx.currentTime);
      oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.1);
      oscillator.frequency.setValueAtTime(800, ctx.currentTime + 0.2);

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn('Failed to play notification sound:', e);
    }
  }, [soundEnabled]);

  const sendNotification = useCallback(
    (title: string, body: string) => {
      if (!notificationEnabled) return;

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(title, { body, icon: '/favicon.ico' });
      }
    },
    [notificationEnabled]
  );

  const requestNotificationPermission = useCallback(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    requestNotificationPermission();
  }, [requestNotificationPermission]);

  useEffect(() => {
    if (isRunning) {
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
  }, [isRunning]);

  useEffect(() => {
    if (currentTask && currentTask.status === 'in_progress' && !isBreak) {
      setIsRunning(true);
      startTimeRef.current = Date.now() - elapsed * 1000;
    } else {
      setIsRunning(false);
    }
  }, [currentTask]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      if (isBreak) {
        setBreakElapsed((prev) => {
          const next = prev + 1;
          if (next >= breakDuration) {
            setIsRunning(false);
            setShowTimeUpModal(true);
            playNotificationSound();
            sendNotification('休息结束', '休息时间已结束，准备开始下一个任务！');
            return prev;
          }
          return next;
        });
      } else {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= timeSlice) {
            setIsRunning(false);
            setShowTimeUpModal(true);
            playNotificationSound();
            sendNotification('时间片结束', '当前任务的时间片已用完，请选择继续或休息。');
            return prev;
          }
          return next;
        });
      }
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, isBreak, timeSlice, breakDuration, playNotificationSound, sendNotification]);

  const handlePause = async () => {
    if (!currentTask) return;
    try {
      await pauseMutation.mutateAsync(currentTask.id);
      setIsRunning(false);
      addMessage({ type: 'info', content: '任务已暂停' });
    } catch (error) {
      addMessage({ type: 'error', content: '暂停失败' });
    }
  };

  const handleResume = async () => {
    if (!currentTask) return;
    try {
      await startMutation.mutateAsync(currentTask.id);
      setIsRunning(true);
      addMessage({ type: 'success', content: '任务已继续' });
    } catch (error) {
      addMessage({ type: 'error', content: '继续失败' });
    }
  };

  const handleComplete = async () => {
    if (!currentTask) return;
    try {
      await completeMutation.mutateAsync(currentTask.id);
      setIsRunning(false);
      setElapsed(0);
      addMessage({ type: 'success', content: '任务已完成！' });
      refetch();
    } catch (error) {
      addMessage({ type: 'error', content: '完成失败' });
    }
  };

  const handleSkip = async () => {
    if (!currentTask) return;
    try {
      await demoteMutation.mutateAsync(currentTask.id);
      setIsRunning(false);
      setElapsed(0);
      addMessage({ type: 'info', content: '任务已降级' });
      refetch();
    } catch (error) {
      addMessage({ type: 'error', content: '降级失败' });
    }
  };

  const handleStartBreak = () => {
    setIsBreak(true);
    setBreakElapsed(0);
    setIsRunning(true);
    setShowTimeUpModal(false);
  };

  const handleContinueWork = () => {
    setIsBreak(false);
    setIsRunning(true);
    setShowTimeUpModal(false);
  };

  const handleDismissModal = () => {
    setShowTimeUpModal(false);
    setIsRunning(false);
  };

  const circumference = 2 * Math.PI * 140;
  const strokeDashoffset = circumference * (1 - progress);

  const progressColor = isBreak
    ? '#10B981'
    : progress < 0.5
      ? queueConfig.color
      : progress < 0.8
        ? '#f59e0b'
        : '#ef4444';

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 dark:text-slate-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (!currentTask) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center max-w-md px-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', duration: 0.5 }}
            className="w-24 h-24 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto mb-6"
          >
            <Coffee size={40} className="text-slate-400 dark:text-slate-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">当前没有进行中的任务</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-6">
            从任务队列中选择一个任务开始专注，或者创建新任务
          </p>
          <Link
            to="/scheduler"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Target size={18} />
            前往任务队列
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-slate-50 dark:bg-slate-900 p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link
            to="/scheduler"
            className="flex items-center gap-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft size={20} />
            <span>返回任务队列</span>
          </Link>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                soundEnabled ? 'bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
              title={soundEnabled ? '关闭声音' : '开启声音'}
            >
              {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>
            <button
              onClick={() => setNotificationEnabled(!notificationEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                notificationEnabled ? 'bg-slate-100 dark:bg-slate-800 text-cyan-600 dark:text-cyan-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
              }`}
              title={notificationEnabled ? '关闭通知' : '开启通知'}
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
              >
                <defs>
                  <filter id="glow-large" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                  <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={progressColor} />
                    <stop offset="100%" stopColor={progressColor} stopOpacity="0.6" />
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
                  transition={{ duration: 0.5, ease: 'easeOut' }}
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
                    <Coffee size={28} className="text-emerald-500 dark:text-emerald-400" />
                  </motion.div>
                )}

                <motion.div
                  className="text-6xl font-mono font-bold tracking-wider"
                  style={{ color: progressColor }}
                  key={formatTime(remaining)}
                  initial={{ scale: 1.1 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.2 }}
                >
                  {formatTime(remaining)}
                </motion.div>

                <div className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                  {isBreak ? '休息时间' : '专注时间'}
                </div>

                <div className="text-sm text-slate-400 dark:text-slate-600 mt-1">
                  {Math.round(progress * 100)}%
                </div>
              </div>

              {isRunning && (
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
                    ease: 'easeInOut',
                  }}
                />
              )}
            </div>

            <div className="flex items-center gap-4 mt-8">
              {isRunning ? (
                <motion.button
                  onClick={handlePause}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Pause size={20} />
                  <span className="font-medium">暂停</span>
                </motion.button>
              ) : (
                <motion.button
                  onClick={handleResume}
                  className="flex items-center gap-2 px-8 py-4 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-200 dark:hover:bg-cyan-500/30 transition-all"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Play size={20} />
                  <span className="font-medium">继续</span>
                </motion.button>
              )}

              <motion.button
                onClick={handleComplete}
                className="flex items-center gap-2 px-8 py-4 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Check size={20} />
                <span className="font-medium">完成</span>
              </motion.button>
            </div>

            <div className="mt-4 flex items-center gap-6 text-sm text-slate-400 dark:text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: queueConfig.color }} />
                <span>已用: {formatTime(isBreak ? breakElapsed : elapsed)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-400" />
                <span>总计: {formatTime(isBreak ? breakDuration : timeSlice)}</span>
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
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${queueConfig.bgClass} ${queueConfig.textClass}`}>
                      Q{currentTask.queue_level}
                    </span>
                    <span className="text-xs text-slate-400 dark:text-slate-500">{queueConfig.name}</span>
                  </div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mt-1">{currentTask.title}</h2>
                </div>
              </div>

              {currentTask.description && (
                <p className="text-slate-500 dark:text-slate-400 text-sm mb-4">{currentTask.description}</p>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400 dark:text-slate-500">
                {currentTask.estimated_duration && (
                  <div className="flex items-center gap-2">
                    <Clock size={14} className={queueConfig.textClass} />
                    <span>预计 {formatDuration(currentTask.estimated_duration)}</span>
                  </div>
                )}

                {currentTask.deadline && (
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-red-500 dark:text-red-400" />
                    <span className="text-red-500 dark:text-red-400">
                      截止 {new Date(currentTask.deadline).toLocaleDateString()}
                    </span>
                  </div>
                )}

                {currentTask.tags && currentTask.tags.length > 0 && (
                  <div className="flex items-center gap-2">
                    <Tag size={14} className="text-indigo-500 dark:text-indigo-400" />
                    <span className="text-indigo-500 dark:text-indigo-400">{currentTask.tags.join(', ')}</span>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">操作选项</h3>
              <div className="space-y-3">
                <motion.button
                  onClick={handleSkip}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <SkipForward size={18} className="text-amber-500 dark:text-amber-400" />
                  <div className="text-left">
                    <div className="font-medium">跳过任务</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">任务将降级到下一队列</div>
                  </div>
                </motion.button>

                <motion.button
                  onClick={handleStartBreak}
                  className="w-full flex items-center gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                  whileHover={{ x: 4 }}
                >
                  <Coffee size={18} className="text-emerald-500 dark:text-emerald-400" />
                  <div className="text-left">
                    <div className="font-medium">开始休息</div>
                    <div className="text-xs text-slate-400 dark:text-slate-500">
                      休息 {settings?.break_duration || 5} 分钟
                    </div>
                  </div>
                </motion.button>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 p-6">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">时间片设置</h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 rounded-xl bg-cyan-100 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20">
                  <div className="text-xs text-cyan-600 dark:text-cyan-400 mb-1">Q0 紧急</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {settings?.q0_time_slice || 15}分钟
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
                  <div className="text-xs text-emerald-600 dark:text-emerald-400 mb-1">Q1 重要</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {settings?.q1_time_slice || 25}分钟
                  </div>
                </div>
                <div className="text-center p-3 rounded-xl bg-amber-100 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
                  <div className="text-xs text-amber-600 dark:text-amber-400 mb-1">Q2 普通</div>
                  <div className="text-lg font-bold text-slate-900 dark:text-white">
                    {settings?.q2_time_slice || 45}分钟
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
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="p-3 rounded-full bg-amber-100 dark:bg-amber-500/20">
                    <AlertCircle size={24} className="text-amber-500 dark:text-amber-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                      {isBreak ? '休息结束' : '时间片结束'}
                    </h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {isBreak ? '休息时间已结束' : '当前任务的时间片已用完'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 mt-6">
                  {isBreak ? (
                    <>
                      <motion.button
                        onClick={handleContinueWork}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        继续工作
                      </motion.button>
                      <motion.button
                        onClick={handleDismissModal}
                        className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        稍后处理
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
                        开始休息
                      </motion.button>
                      <motion.button
                        onClick={handleContinueWork}
                        className="w-full py-3 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        继续工作
                      </motion.button>
                      <motion.button
                        onClick={handleComplete}
                        className="w-full py-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-emerald-600 dark:text-emerald-400 font-medium"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                      >
                        标记完成
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
