import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { useWhiteNoise } from "../../hooks/common/useWhiteNoise";
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

// 预构建 id -> 选项 映射，避免逐个选项线性 find（原为 O(options)）
const NOISE_OPTION_BY_ID = new Map(
  NOISE_OPTIONS.map((option) => [option.id, option]),
);

const getNoiseOption = (type: WhiteNoiseType) => {
  if (type === "none") return undefined;
  return NOISE_OPTION_BY_ID.get(type as AudioWhiteNoiseType);
};

interface FocusModeNoisePanelProps {
  showNoiseSelector: boolean;
  onToggleNoiseSelector: () => void;
}

export const FocusModeNoisePanel: React.FC<FocusModeNoisePanelProps> = ({
  showNoiseSelector,
  onToggleNoiseSelector,
}) => {
  const { t } = useTranslation();
  const {
    mixedNoises,
    activePresetId,
    allPresets,
    addNoise,
    removeNoise,
    setNoiseVolume,
    loadPreset,
  } = useWhiteNoise();

  // 预构建 type -> 噪声项 映射，避免渲染/切换时对每个选项线性 find（原为 O(options*mixedNoises)）
  const mixedNoiseByType = useMemo(() => {
    const m = new Map<WhiteNoiseType, (typeof mixedNoises)[number]>();
    mixedNoises.forEach((n) => {
      m.set(n.type, n);
    });
    return m;
  }, [mixedNoises]);

  const handleNoiseToggle = (type: AudioWhiteNoiseType) => {
    if (mixedNoiseByType.has(type as WhiteNoiseType)) {
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
          <span className="text-xs text-slate-400">{t('scheduler.focusModeNoise.preset')}</span>
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
                const isActive = mixedNoiseByType.has(option.id);
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
        {showNoiseSelector ? t('scheduler.focusModeNoise.collapse') : t('scheduler.focusModeNoise.expandMore')}
      </button>

      <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1">
          <Shield size={12} />
          <span>{t('scheduler.focusModeNoise.blocking')}</span>
        </div>
        <span>|</span>
        <span>{t('scheduler.focusModeNoise.exitHint')}</span>
      </div>
    </div>
  );
};
