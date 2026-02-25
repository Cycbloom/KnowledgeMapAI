import React, { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, Check, Coffee } from 'lucide-react';

interface TaskTimerProps {
  duration: number;
  elapsed: number;
  isRunning: boolean;
  isBreak?: boolean;
  onPause?: () => void;
  onResume?: () => void;
  onComplete?: () => void;
}

export const TaskTimer: React.FC<TaskTimerProps> = ({
  duration,
  elapsed,
  isRunning,
  isBreak = false,
  onPause,
  onResume,
  onComplete,
}) => {
  const [displayTime, setDisplayTime] = useState(elapsed);
  const [glowOffset, setGlowOffset] = useState(0);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplayTime(elapsed);
  }, [elapsed]);

  useEffect(() => {
    if (isRunning) {
      const animate = () => {
        setGlowOffset(Math.sin(Date.now() / 500) * 10);
        animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
      return () => {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };
    }
  }, [isRunning]);

  const remaining = Math.max(0, duration - displayTime);
  const progress = duration > 0 ? Math.min(1, displayTime / duration) : 0;
  const circumference = 2 * Math.PI * 90;
  const strokeDashoffset = circumference * (1 - progress);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progressColor = isBreak 
    ? '#10B981' 
    : progress < 0.5 
      ? '#06b6d4'
      : progress < 0.8 
        ? '#f59e0b' 
        : '#ef4444';

  return (
    <div className="relative flex flex-col items-center justify-center p-6">
      <div className="relative w-52 h-52">
        <svg
          className="w-full h-full transform -rotate-90"
          viewBox="0 0 200 200"
        >
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <linearGradient id="progressGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={progressColor} />
              <stop offset="100%" stopColor={progressColor} stopOpacity="0.6" />
            </linearGradient>
          </defs>

          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="rgba(148, 163, 184, 0.2)"
            className="dark:[stroke:rgba(30,41,59,0.8)]"
            strokeWidth="8"
          />

          <motion.circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="url(#progressGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            filter="url(#glow)"
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />

          <circle
            cx="100"
            cy="100"
            r="75"
            fill="none"
            stroke="rgba(148, 163, 184, 0.15)"
            className="dark:[stroke:rgba(51,65,85,0.3)]"
            strokeWidth="1"
            strokeDasharray="4 4"
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {isBreak ? (
            <Coffee size={24} className="text-emerald-500 dark:text-emerald-400 mb-1" />
          ) : null}
          
          <motion.div
            className="text-4xl font-mono font-bold tracking-wider"
            style={{ color: progressColor }}
            key={formatTime(remaining)}
            initial={{ scale: 1.1 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {formatTime(remaining)}
          </motion.div>
          
          <div className="text-xs text-slate-400 dark:text-slate-500 mt-1">
            {isBreak ? '休息时间' : '专注时间'}
          </div>
          
          {duration > 0 && (
            <div className="text-xs text-slate-500 dark:text-slate-600 mt-1">
              {Math.round(progress * 100)}%
            </div>
          )}
        </div>

        {isRunning && (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow: `0 0 ${20 + glowOffset}px ${progressColor}40`,
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

      <div className="flex items-center gap-3 mt-6">
        {isRunning ? (
          <motion.button
            onClick={onPause}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30 hover:bg-amber-200 dark:hover:bg-amber-500/30 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Pause size={18} />
            <span className="font-medium">暂停</span>
          </motion.button>
        ) : (
          <motion.button
            onClick={onResume}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-cyan-100 dark:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-500/30 hover:bg-cyan-200 dark:hover:bg-cyan-500/30 transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Play size={18} />
            <span className="font-medium">继续</span>
          </motion.button>
        )}

        <motion.button
          onClick={onComplete}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 hover:bg-emerald-200 dark:hover:bg-emerald-500/30 transition-all"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <Check size={18} />
          <span className="font-medium">完成</span>
        </motion.button>
      </div>

      <div className="mt-4 flex items-center gap-4 text-xs text-slate-400 dark:text-slate-500">
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-500 dark:bg-cyan-400" />
          <span>已用: {formatTime(displayTime)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-400" />
          <span>总计: {formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};
