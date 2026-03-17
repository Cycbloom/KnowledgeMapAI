import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Volume2,
  VolumeX,
  CloudRain,
  Coffee,
  Trees,
  Waves,
  Flame,
  Minimize2,
  Maximize2,
  Brain,
  BookOpen,
  Settings2,
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Highlighter,
} from 'lucide-react';
import { useFocusStore, WhiteNoiseType } from '../../store/useFocusStore';
import { HighlightedReader } from './HighlightedReader';

const WHITE_NOISE_OPTIONS: { id: WhiteNoiseType; label: string; icon: React.ReactNode }[] = [
  { id: 'none', label: '关闭', icon: <VolumeX size={18} /> },
  { id: 'rain', label: '雨声', icon: <CloudRain size={18} /> },
  { id: 'cafe', label: '咖啡厅', icon: <Coffee size={18} /> },
  { id: 'forest', label: '森林', icon: <Trees size={18} /> },
  { id: 'ocean', label: '海浪', icon: <Waves size={18} /> },
  { id: 'fire', label: '篝火', icon: <Flame size={18} /> },
];

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

interface LearningFocusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  articleContent: string;
  nodeTitle?: string;
  isMobile?: boolean;
}

export const LearningFocusPanel: React.FC<LearningFocusPanelProps> = ({
  isOpen,
  onClose,
  articleContent,
  nodeTitle,
  isMobile = false,
}) => {
  const {
    isActive,
    timeLeft,
    mode,
    sessionsCompleted,
    focusDuration,
    selectedNoise,
    noiseVolume,
    highlightEnabled,
    highlightIntensity,
    startTimer,
    pauseTimer,
    resetTimer,
    setMode,
    setNoise,
    setNoiseVolume,
    setHighlightEnabled,
    setHighlightIntensity,
    exitFocusMode,
  } = useFocusStore();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const createWhiteNoise = useCallback((context: AudioContext): AudioBufferSourceNode => {
    const bufferSize = context.sampleRate * 2;
    const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
    const output = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }, []);

  const stopAudio = useCallback(() => {
    if (noiseSourceRef.current) {
      try {
        noiseSourceRef.current.stop();
      } catch {
        // ignore
      }
      noiseSourceRef.current = null;
    }
  }, []);

  const startAudio = useCallback((noiseType: WhiteNoiseType) => {
    if (noiseType === 'none') {
      stopAudio();
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    stopAudio();

    const gainNode = ctx.createGain();
    gainNode.gain.value = noiseVolume * 0.3;
    gainNode.connect(ctx.destination);
    gainNodeRef.current = gainNode;

    const noiseSource = createWhiteNoise(ctx);
    const filter = ctx.createBiquadFilter();
    
    switch (noiseType) {
      case 'rain':
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        break;
      case 'cafe':
        filter.type = 'bandpass';
        filter.frequency.value = 500;
        filter.Q.value = 0.5;
        break;
      case 'forest':
        filter.type = 'lowpass';
        filter.frequency.value = 800;
        break;
      case 'ocean':
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        break;
      case 'fire':
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        break;
      default:
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
    }
    
    noiseSource.connect(filter);
    filter.connect(gainNode);
    noiseSource.start();
    noiseSourceRef.current = noiseSource;
  }, [noiseVolume, createWhiteNoise, stopAudio]);

  useEffect(() => {
    if (isOpen && selectedNoise !== 'none') {
      startAudio(selectedNoise);
    }
    return () => {
      stopAudio();
    };
  }, [isOpen, selectedNoise, startAudio, stopAudio]);

  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = noiseVolume * 0.3;
    }
  }, [noiseVolume]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleNoiseSelect = (noise: WhiteNoiseType) => {
    setNoise(noise);
    if (noise !== 'none') {
      startAudio(noise);
    } else {
      stopAudio();
    }
  };

  const handleClose = () => {
    stopAudio();
    exitFocusMode();
    onClose();
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const getProgress = () => {
    const total = focusDuration * 60;
    return ((total - timeLeft) / total) * 100;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={containerRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          onMouseMove={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <motion.div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.3) 0%, transparent 50%)`,
            }}
            animate={{
              scale: [1, 1.1, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent z-20"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                    <Brain size={16} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">专注模式</span>
                  </div>
                  {nodeTitle && (
                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                      <BookOpen size={14} />
                      <span className="max-w-[200px] truncate">{nodeTitle}</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={() => setShowSettings(!showSettings)}
                    className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-cyan-500/30 text-cyan-300' : 'bg-white/10 hover:bg-white/20 text-white'}`}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Settings2 size={18} />
                  </motion.button>
                  <motion.button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </motion.button>
                  <motion.button
                    onClick={handleClose}
                    className="p-2 rounded-lg bg-white/10 hover:bg-red-500/50 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <X size={18} />
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="absolute inset-0 flex overflow-hidden pt-16 pb-24">
            <div className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? 'p-4' : 'p-8 lg:p-12'}`}>
              <HighlightedReader
                content={articleContent}
                isDark={true}
                isMobile={isMobile}
              />
            </div>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, x: 300 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 300 }}
                  className="w-80 border-l border-slate-700/50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto p-4 space-y-6"
                >
                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                      <Highlighter size={16} className="text-yellow-400" />
                      智能高亮
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-slate-400">启用高亮</span>
                        <input
                          type="checkbox"
                          checked={highlightEnabled}
                          onChange={(e) => setHighlightEnabled(e.target.checked)}
                          className="w-4 h-4 rounded accent-yellow-500"
                        />
                      </label>
                      {highlightEnabled && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-500">
                            <span>高亮强度</span>
                            <span>{Math.round(highlightIntensity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={highlightIntensity}
                            onChange={(e) => setHighlightIntensity(parseFloat(e.target.value))}
                            className="w-full h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
                      <Volume2 size={16} className="text-cyan-400" />
                      白噪声
                    </h3>
                    <div className="grid grid-cols-3 gap-2">
                      {WHITE_NOISE_OPTIONS.map((option) => (
                        <motion.button
                          key={option.id}
                          onClick={() => handleNoiseSelect(option.id)}
                          className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                            selectedNoise === option.id
                              ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                              : 'bg-white/10 text-slate-400 hover:bg-white/20 border border-transparent'
                          }`}
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                        >
                          {option.icon}
                          <span className="text-[10px]">{option.label}</span>
                        </motion.button>
                      ))}
                    </div>
                    {selectedNoise !== 'none' && (
                      <div className="mt-3 flex items-center gap-3">
                        <VolumeX size={14} className="text-slate-500" />
                        <input
                          type="range"
                          min="0"
                          max="1"
                          step="0.1"
                          value={noiseVolume}
                          onChange={(e) => setNoiseVolume(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-700 rounded-full appearance-none cursor-pointer accent-cyan-500"
                        />
                        <Volume2 size={14} className="text-slate-500" />
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/50 to-transparent z-20"
              >
                <div className="max-w-lg mx-auto">
                  <div className="flex items-center justify-center gap-4 mb-4">
                    <div className="flex p-1 bg-slate-800/50 rounded-xl">
                      {(['focus', 'shortBreak'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setMode(m)}
                          className={`px-4 py-1.5 text-xs font-medium rounded-lg transition-all ${
                            mode === m
                              ? 'bg-cyan-500 text-white shadow-lg'
                              : 'text-slate-400 hover:text-white'
                          }`}
                        >
                          {m === 'focus' ? '专注' : '休息'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-4">
                    <div className="relative">
                      <svg className="w-24 h-24 transform -rotate-90">
                        <circle
                          cx="48"
                          cy="48"
                          r="44"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          className="text-slate-700"
                        />
                        <circle
                          cx="48"
                          cy="48"
                          r="44"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="transparent"
                          strokeDasharray={2 * Math.PI * 44}
                          strokeDashoffset={2 * Math.PI * 44 * (1 - getProgress() / 100)}
                          className={`${
                            mode === 'focus' ? 'text-cyan-500' : 'text-emerald-500'
                          } transition-all duration-1000 ease-linear`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-xl font-bold font-mono text-white">
                          {formatTime(timeLeft)}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {isActive ? '进行中' : '已暂停'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={resetTimer}
                        className="p-2 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
                      >
                        <RotateCcw size={18} />
                      </button>

                      <button
                        onClick={isActive ? pauseTimer : startTimer}
                        className={`p-3 rounded-full shadow-lg transform transition-transform active:scale-95 ${
                          isActive
                            ? 'bg-amber-500/80 text-white hover:bg-amber-500'
                            : 'bg-cyan-500 text-white hover:bg-cyan-600'
                        }`}
                      >
                        {isActive ? (
                          <Pause size={20} fill="currentColor" />
                        ) : (
                          <Play size={20} fill="currentColor" className="ml-0.5" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          if (mode === 'focus') setMode('shortBreak');
                          else setMode('focus');
                        }}
                        className="p-2 rounded-full bg-slate-700 text-slate-400 hover:bg-slate-600 transition-colors"
                      >
                        <SkipForward size={18} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-slate-500 flex items-center justify-center gap-1">
                    <CheckCircleIcon size={12} />
                    <span>本次已完成 {sessionsCompleted} 个专注时段</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 60,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            <div className="absolute inset-0 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-4 rounded-full border border-cyan-500/5" />
            <div className="absolute inset-8 rounded-full border border-cyan-500/10" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
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
