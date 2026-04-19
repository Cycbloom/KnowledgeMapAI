import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteNoise } from "../../hooks/useWhiteNoise";
import { useUnifiedTimer } from "../../hooks/scheduler";
import { AudioVisualizer } from "../common/AudioVisualizer";
import {
  NOISE_OPTIONS,
  WhiteNoiseType as AudioWhiteNoiseType,
} from "../../utils/audioSynthesis";
import { NoisePreset, WhiteNoiseType } from "../../store/useFocusStore";
import {
  CloudRain,
  Coffee,
  Trees,
  Waves,
  Flame,
  CloudLightning,
  Droplets,
  Wind,
  BookOpen,
  Moon,
  Train,
  Plane,
  Circle,
  Bell,
  Activity,
  Radio,
  Volume2,
  X,
  Shield,
  Minimize2,
  Maximize2,
  LucideIcon,
} from "lucide-react";

interface FocusModeProps {
  isOpen: boolean;
  onClose: () => void;
  taskId?: string;
  taskTitle?: string;
  onFocusComplete?: () => void;
  children?: React.ReactNode;
}

const ICON_MAP: Record<string, LucideIcon> = {
  CloudRain,
  Coffee,
  Trees,
  Waves,
  Flame,
  CloudLightning,
  Droplets,
  Wind,
  BookOpen,
  Moon,
  Train,
  Plane,
  Circle,
  Bell,
  Activity,
  Radio,
};

const getIcon = (
  iconName: string | undefined,
  size: number = 18,
): React.ReactNode => {
  if (!iconName) return <Volume2 size={size} />;
  const IconComponent = ICON_MAP[iconName];
  return IconComponent ? (
    <IconComponent size={size} />
  ) : (
    <Volume2 size={size} />
  );
};

const getNoiseOption = (type: WhiteNoiseType) => {
  if (type === "none") return undefined;
  return NOISE_OPTIONS.find(
    (option) => option.id === (type as AudioWhiteNoiseType),
  );
};

export const FocusMode: React.FC<FocusModeProps> = ({
  isOpen,
  onClose,
  taskId,
  taskTitle,
  onFocusComplete: _onFocusComplete,
  children,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showNoiseSelector, setShowNoiseSelector] = useState(false);

  const { timeLeft, isActive, progress, start } = useUnifiedTimer();

  const {
    isPlaying,
    mixedNoises,
    activePresetId,
    allPresets,
    analyserData,
    startMixer,
    stopMixer,
    addNoise,
    removeNoise,
    setNoiseVolume,
    loadPreset,
  } = useWhiteNoise();

  useEffect(() => {
    if (isOpen) {
      startMixer();
      if (taskId && !isActive) {
        start(taskId, 25);
      }
    } else {
      stopMixer();
    }
  }, [isOpen, startMixer, stopMixer, taskId, isActive, start]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleNoiseToggle = (type: AudioWhiteNoiseType) => {
    if (mixedNoises.find((n) => n.type === (type as WhiteNoiseType))) {
      removeNoise(type as WhiteNoiseType);
    } else {
      addNoise(type as WhiteNoiseType);
    }
  };

  const handlePresetClick = (preset: NoisePreset) => {
    loadPreset(preset);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"
          onMouseMove={() => setShowControls(true)}
          onMouseLeave={() => setShowControls(false)}
        >
          <motion.div
            className="absolute inset-0 opacity-20"
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
              ease: "easeInOut",
            }}
          />

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-0 left-0 right-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent"
              >
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30">
                    <Shield size={16} className="text-cyan-400" />
                    <span className="text-sm text-cyan-300">
                      专注模式已开启
                    </span>
                  </div>
                  {taskTitle && (
                    <span className="text-slate-400 text-sm">
                      | {taskTitle}
                    </span>
                  )}
                  {isActive && taskId && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-700/50 border border-slate-600/30">
                      <span className="text-xs text-slate-300 font-mono">
                        {Math.floor(timeLeft / 60)
                          .toString()
                          .padStart(2, "0")}
                        :{(timeLeft % 60).toString().padStart(2, "0")}
                      </span>
                      <div className="w-16 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-400 rounded-full transition-all duration-1000"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {Math.round(progress)}%
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <motion.button
                    onClick={toggleFullscreen}
                    className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {isFullscreen ? (
                      <Minimize2 size={18} />
                    ) : (
                      <Maximize2 size={18} />
                    )}
                  </motion.button>
                  <motion.button
                    onClick={onClose}
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

          <div className="absolute inset-0 flex items-center justify-center">
            {children}
          </div>

          {isPlaying && analyserData && (
            <AudioVisualizer
              analyserData={analyserData}
              type="wave"
              width={400}
              height={80}
              color="rgba(6, 182, 212, 0.5)"
              className="absolute bottom-24 left-1/2 -translate-x-1/2 opacity-50"
            />
          )}

          <AnimatePresence>
            {showControls && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent"
              >
                <div className="max-w-2xl mx-auto space-y-4">
                  {allPresets.length > 0 && (
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <span className="text-xs text-slate-400">预设</span>
                      <div className="flex items-center gap-1">
                        {allPresets.slice(0, 4).map((preset) => (
                          <motion.button
                            key={preset.id}
                            onClick={() => handlePresetClick(preset)}
                            className={`px-3 py-1 rounded-lg text-xs transition-all ${
                              activePresetId === preset.id
                                ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                                : "bg-white/10 text-slate-400 hover:bg-white/20 border border-transparent"
                            }`}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {preset.name}
                          </motion.button>
                        ))}
                      </div>
                    </div>
                  )}

                  {mixedNoises.length > 0 && (
                    <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
                      {mixedNoises.map((noise) => {
                        const option = getNoiseOption(noise.type);
                        return (
                          <div
                            key={noise.type}
                            className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1"
                          >
                            {getIcon(option?.icon, 16)}
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.1"
                              value={noise.volume}
                              onChange={(e) =>
                                setNoiseVolume(
                                  noise.type,
                                  parseFloat(e.target.value),
                                )
                              }
                              className="w-16 accent-cyan-500"
                            />
                            <button
                              onClick={() => removeNoise(noise.type)}
                              className="text-slate-400 hover:text-red-400"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <AnimatePresence>
                    {showNoiseSelector && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-6 gap-2 p-4 bg-black/30 rounded-lg mb-4">
                          {NOISE_OPTIONS.map((option) => {
                            const isActive = mixedNoises.find(
                              (n) => n.type === option.id,
                            );
                            return (
                              <motion.button
                                key={option.id}
                                onClick={() => handleNoiseToggle(option.id)}
                                className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                                  isActive
                                    ? "bg-cyan-500/30 text-cyan-300 border border-cyan-500/50"
                                    : "bg-white/10 text-slate-400 hover:bg-white/20 border border-transparent"
                                }`}
                                title={option.label}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {getIcon(option.icon, 18)}
                                <span className="text-[10px]">
                                  {option.label}
                                </span>
                              </motion.button>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    onClick={() => setShowNoiseSelector(!showNoiseSelector)}
                    className="text-xs text-cyan-400 hover:text-cyan-300 mb-4 w-full text-center"
                  >
                    {showNoiseSelector ? "收起" : "展开更多声音"}
                  </button>

                  <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Shield size={12} />
                      <span>干扰屏蔽中</span>
                    </div>
                    <span>|</span>
                    <span>按 ESC 退出专注模式</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] pointer-events-none"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 60,
              repeat: Infinity,
              ease: "linear",
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
