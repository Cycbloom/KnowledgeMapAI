import React, { useEffect, useState, useRef } from 'react';
import { useFocusStore, TimerMode } from '../store/useFocusStore';
import { Play, Pause, RotateCcw, Coffee, Brain, X, Settings2, Minimize2, Maximize2, Volume2, VolumeX, SkipForward, GripVertical } from 'lucide-react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const getModeLabel = (m: TimerMode) => {
  switch (m) {
    case 'focus': return '专注';
    case 'shortBreak': return '小憩';
    case 'longBreak': return '长休';
  }
};

export const FocusTimer: React.FC = () => {
  const { 
    isActive, 
    timeLeft, 
    mode, 
    sessionsCompleted,
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    soundEnabled,
    startTimer, 
    pauseTimer, 
    resetTimer, 
    setMode, 
    tick,
    updateSettings 
  } = useFocusStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const dragControls = useDragControls();
  const isDragging = useRef(false);

  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(tick, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, tick]);

  useEffect(() => {
    if (isActive) {
      document.title = `${formatTime(timeLeft)} - ${getModeLabel(mode)}`;
    } else {
      document.title = 'KnowledgeMap';
    }
    return () => {
      document.title = 'KnowledgeMap';
    };
  }, [isActive, timeLeft, mode]);

  const getProgress = () => {
    let total = focusDuration * 60;
    if (mode === 'shortBreak') total = shortBreakDuration * 60;
    if (mode === 'longBreak') total = longBreakDuration * 60;
    return ((total - timeLeft) / total) * 100;
  };

  const toggleExpand = (e: React.MouseEvent) => {
    // Prevent toggle if we were dragging
    if (isDragging.current) return;
    setIsExpanded(!isExpanded);
  };

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      onDragStart={() => { isDragging.current = true; }}
      onDragEnd={() => { setTimeout(() => { isDragging.current = false; }, 100); }}
      layout
      initial={false}
      className={`fixed z-50 shadow-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden ${
        isExpanded 
          ? 'rounded-2xl w-72' 
          : 'rounded-full hover:shadow-2xl transition-shadow'
      }`}
      style={{
        // Default position
        right: 16,
        bottom: 96,
      }}
    >
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <motion.div 
            key="mini"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2 p-2 cursor-pointer"
            onPointerDown={(e) => dragControls.start(e)}
            onClick={toggleExpand}
          >
            <div className={`p-2 rounded-full ${isActive ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400'}`}>
              {mode === 'focus' ? <Brain size={20} /> : <Coffee size={20} />}
            </div>
            <div className="flex flex-col pr-2">
              <span className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200 select-none">
                {formatTime(timeLeft)}
              </span>
              {isActive && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 select-none">
                  {getModeLabel(mode)}中...
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            {/* Header */}
            <div 
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-700 cursor-move"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Brain className="text-blue-500" size={18} />
                <span className="font-semibold text-gray-700 dark:text-gray-200 select-none">专注模式</span>
              </div>
              <div className="flex items-center gap-1" onPointerDown={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500"
                >
                  <Settings2 size={16} />
                </button>
                <button 
                  onClick={toggleExpand}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>

            {showSettings ? (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">专注时长 (分钟)</label>
                  <input 
                    type="range" 
                    min="1" 
                    max="60" 
                    value={focusDuration} 
                    onChange={(e) => updateSettings({ focusDuration: parseInt(e.target.value) })}
                    className="w-full accent-blue-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>1</span>
                    <span>{focusDuration}</span>
                    <span>60</span>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">休息时长 (分钟)</label>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      value={shortBreakDuration}
                      onChange={(e) => updateSettings({ shortBreakDuration: parseInt(e.target.value) })}
                      className="w-1/2 p-2 rounded border dark:bg-slate-700 dark:border-slate-600 text-sm"
                      placeholder="小憩"
                    />
                    <input 
                      type="number" 
                      value={longBreakDuration}
                      onChange={(e) => updateSettings({ longBreakDuration: parseInt(e.target.value) })}
                      className="w-1/2 p-2 rounded border dark:bg-slate-700 dark:border-slate-600 text-sm"
                      placeholder="长休"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">提示音</span>
                  <button 
                    onClick={() => updateSettings({ soundEnabled: !soundEnabled })}
                    className={`p-2 rounded-lg ${soundEnabled ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}
                  >
                    {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                  </button>
                </div>
                
                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2 mt-2 text-sm bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  完成
                </button>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center">
                {/* Tabs */}
                <div className="flex p-1 bg-gray-100 dark:bg-slate-700 rounded-xl mb-6 w-full">
                  {(['focus', 'shortBreak', 'longBreak'] as TimerMode[]).map((m) => (
                    <button
                      key={m}
                      onClick={() => setMode(m)}
                      className={`flex-1 py-1.5 text-xs font-medium rounded-lg transition-all ${
                        mode === m 
                          ? 'bg-white dark:bg-slate-600 shadow text-gray-800 dark:text-white' 
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'
                      }`}
                    >
                      {getModeLabel(m)}
                    </button>
                  ))}
                </div>

                {/* Timer Display */}
                <div className="relative mb-6">
                  <svg className="w-48 h-48 transform -rotate-90">
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      className="text-gray-100 dark:text-slate-700"
                    />
                    <circle
                      cx="96"
                      cy="96"
                      r="88"
                      stroke="currentColor"
                      strokeWidth="8"
                      fill="transparent"
                      strokeDasharray={2 * Math.PI * 88}
                      strokeDashoffset={2 * Math.PI * 88 * (1 - getProgress() / 100)}
                      className={`${
                        mode === 'focus' ? 'text-blue-500' : 'text-emerald-500'
                      } transition-all duration-1000 ease-linear`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-bold font-mono text-gray-800 dark:text-white">
                      {formatTime(timeLeft)}
                    </span>
                    <span className="text-sm text-gray-400 mt-1">
                      {isActive ? '进行中' : '已暂停'}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-4">
                  <button
                    onClick={resetTimer}
                    className="p-3 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <RotateCcw size={20} />
                  </button>
                  
                  <button
                    onClick={isActive ? pauseTimer : startTimer}
                    className={`p-4 rounded-full shadow-lg transform transition-transform active:scale-95 ${
                      isActive 
                        ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' 
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                    }`}
                  >
                    {isActive ? <Pause size={28} fill="currentColor" /> : <Play size={28} fill="currentColor" className="ml-1" />}
                  </button>

                  <button
                     onClick={() => {
                       if (mode === 'focus') setMode('shortBreak');
                       else setMode('focus');
                     }}
                     className="p-3 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <SkipForward size={20} />
                  </button>
                </div>

                {/* Session Count */}
                <div className="mt-6 text-xs text-gray-400 flex items-center gap-1">
                  <CheckCircleIcon size={12} />
                  <span>本次已完成 {sessionsCompleted} 个专注时段</span>
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const CheckCircleIcon = ({ size }: { size: number }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);
