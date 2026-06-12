import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteNoise } from "../../hooks/useWhiteNoise";
import {
  NOISE_OPTIONS,
  WhiteNoiseType as AudioWhiteNoiseType,
} from "../../utils/audioSynthesis";
import { NoisePreset, WhiteNoiseType } from "../../store/useNoiseStore";
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
  LucideIcon,
} from "lucide-react";

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

interface FocusModeNoisePanelProps {
  showNoiseSelector: boolean;
  onToggleNoiseSelector: () => void;
}

export const FocusModeNoisePanel: React.FC<FocusModeNoisePanelProps> = ({
  showNoiseSelector,
  onToggleNoiseSelector,
}) => {
  const {
    mixedNoises,
    activePresetId,
    allPresets,
    addNoise,
    removeNoise,
    setNoiseVolume,
    loadPreset,
  } = useWhiteNoise();

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
                    ? "bg-primary-500/30 text-primary-300 border border-primary-500/50"
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
                    setNoiseVolume(noise.type, parseFloat(e.target.value))
                  }
                  className="w-16 accent-primary-500"
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
                        ? "bg-primary-500/30 text-primary-300 border border-primary-500/50"
                        : "bg-white/10 text-slate-400 hover:bg-white/20 border border-transparent"
                    }`}
                    title={option.label}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {getIcon(option.icon, 18)}
                    <span className="text-[10px]">{option.label}</span>
                  </motion.button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={onToggleNoiseSelector}
        className="text-xs text-primary-400 hover:text-primary-300 mb-4 w-full text-center"
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
  );
};
