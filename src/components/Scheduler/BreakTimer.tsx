import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Coffee,
  Play,
  Pause,
  SkipForward,
  RotateCcw,
  CheckCircle,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useTimerStore } from '../../store/useTimerStore';
import { formatTimeFromSeconds } from '../../utils/formatters';

interface BreakTimerProps {
  isOpen: boolean;
  onClose: () => void;
  pomodorosCompleted: number;
  onResumeTask: () => void;
  onSwitchTask: () => void;
}

const BREAK_SUGGESTIONS = [
  { icon: '👀', text: '远眺窗外，放松眼睛' },
  { icon: '🧘', text: '做几个深呼吸' },
  { icon: '🚶', text: '站起来走动一下' },
  { icon: '💧', text: '喝杯水' },
  { icon: '💪', text: '伸展一下身体' },
  { icon: '🎵', text: '听一首喜欢的歌' },
];

export const BreakTimer: React.FC<BreakTimerProps> = ({
  isOpen,
  onClose,
  pomodorosCompleted,
  onResumeTask,
  onSwitchTask,
}) => {
  const timeLeft = useTimerStore(s => s.timeLeft);
  const isActive = useTimerStore(s => s.isActive);
  const isPaused = useTimerStore(s => s.isPaused);
  const mode = useTimerStore(s => s.mode);
  const progress = useTimerStore(s => s.progress);

  const [currentSuggestion, setCurrentSuggestion] = useState(0);
  const isRunning = isActive && !isPaused;
  const showEndPrompt = !isActive && timeLeft === 0;
  const breakType = mode === 'longBreak' ? 'long' : 'short';

  useEffect(() => {
    if (isOpen) {
      setCurrentSuggestion(Math.floor(Math.random() * BREAK_SUGGESTIONS.length));
    }
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && isRunning) {
      const suggestionInterval = setInterval(() => {
        setCurrentSuggestion((prev) => (prev + 1) % BREAK_SUGGESTIONS.length);
      }, 8000);
      return () => clearInterval(suggestionInterval);
    }
  }, [isOpen, isRunning]);

  const circumference = 2 * Math.PI * 120;
  const strokeDashoffset = circumference * (1 - progress / 100);

  if (!isOpen || (mode !== 'shortBreak' && mode !== 'longBreak')) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-modal-upper flex items-center justify-center bg-gradient-to-br from-emerald-900/95 via-teal-900/95 to-primary-900/95 backdrop-blur-sm"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="relative w-full max-w-md mx-4"
        >
          <div className="text-center mb-6">
            <motion.div
              initial={{ y: -20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-500/30 mb-4"
            >
              <Coffee size={20} className="text-emerald-400" />
              <span className="text-emerald-300 font-medium">
                {breakType === 'long' ? '长休息时间' : '小憩时间'}
              </span>
            </motion.div>

            {breakType === 'long' && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-emerald-400/80 text-sm"
              >
                🎉 恭喜完成 {pomodorosCompleted} 个番茄钟！享受你的长休息吧
              </motion.p>
            )}
          </div>

          {!showEndPrompt ? (
            <>
              <div className="relative w-64 h-64 mx-auto mb-8">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 256 256"
                >
                  <defs>
                    <linearGradient id="breakGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#10B981" />
                      <stop offset="100%" stopColor="#06B6D4" />
                    </linearGradient>
                    <filter id="breakGlow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  <circle
                    cx="128"
                    cy="128"
                    r="120"
                    fill="none"
                    stroke="rgba(16, 185, 129, 0.2)"
                    strokeWidth="10"
                  />

                  <motion.circle
                    cx="128"
                    cy="128"
                    r="120"
                    fill="none"
                    stroke="url(#breakGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    filter="url(#breakGlow)"
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                  />
                </svg>

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.div
                    className="text-5xl font-mono font-bold text-white"
                    key={timeLeft}
                    initial={{ scale: 1.05 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2 }}
                  >
                    {formatTimeFromSeconds(timeLeft)}
                  </motion.div>
                  <div className="text-emerald-300/60 text-sm mt-2">
                    {isRunning ? '休息中...' : '已暂停'}
                  </div>
                </div>

                {isRunning && (
                  <motion.div
                    className="absolute inset-0 rounded-full pointer-events-none"
                    animate={{
                      boxShadow: [
                        '0 0 20px rgba(16, 185, 129, 0.3)',
                        '0 0 40px rgba(16, 185, 129, 0.4)',
                        '0 0 20px rgba(16, 185, 129, 0.3)',
                      ],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </div>

              <motion.div
                key={currentSuggestion}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center mb-6"
              >
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 text-white/80">
                  <span className="text-lg">{BREAK_SUGGESTIONS[currentSuggestion].icon}</span>
                  <span className="text-sm">{BREAK_SUGGESTIONS[currentSuggestion].text}</span>
                </div>
              </motion.div>

              <div className="flex items-center justify-center gap-4">
                <motion.button
                  onClick={() => useTimerStore.getState().reset()}
                  className="p-3 rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <RotateCcw size={20} />
                </motion.button>

                <motion.button
                  onClick={() => isRunning ? useTimerStore.getState().pause() : useTimerStore.getState().resume()}
                  className={`p-4 rounded-full shadow-lg ${
                    isRunning
                      ? 'bg-amber-500 text-white'
                      : 'bg-emerald-500 text-white'
                  }`}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isRunning ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
                </motion.button>

                <motion.button
                  onClick={() => useTimerStore.getState().skipToNext()}
                  className="p-3 rounded-full bg-white/10 text-white/70 hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <SkipForward size={20} />
                </motion.button>
              </div>
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', delay: 0.1 }}
                className="w-20 h-20 mx-auto mb-6 rounded-full bg-emerald-500/20 flex items-center justify-center"
              >
                <CheckCircle size={40} className="text-emerald-400" />
              </motion.div>

              <h3 className="text-2xl font-bold text-white mb-2">休息结束！</h3>
              <p className="text-emerald-300/80 mb-8">准备好继续专注了吗？</p>

              <div className="space-y-3">
                <motion.button
                  onClick={onResumeTask}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Play size={18} />
                  <span>继续当前任务</span>
                </motion.button>

                <motion.button
                  onClick={onSwitchTask}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <ArrowRight size={18} />
                  <span>切换到下一个任务</span>
                </motion.button>

                <motion.button
                  onClick={onClose}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white/60 hover:text-white/80 transition-colors"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Sparkles size={18} />
                  <span>稍后再说</span>
                </motion.button>
              </div>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
