import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Volume2,
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
  Lock,
  Unlock,
  CloudLightning,
  Droplets,
  Wind,
  Moon,
  Train,
  Plane,
  Circle,
  Bell,
  Activity,
  Radio,
  Save,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useFocusStore } from "../../store/useFocusStore";
import { useShallow } from "zustand/react/shallow";
import { WhiteNoiseType, NoiseCategory } from "../../store/useNoiseStore";
import { HighlightedReader } from "./HighlightedReader";
import { useWhiteNoise } from "../../hooks/useWhiteNoise";
import { useTimerStore } from "../../store/useTimerStore";
import { useActivityTracker } from "../../hooks/useActivityTracker";
import { AudioVisualizer } from "../common/AudioVisualizer";
import { PomodoroCycleBar } from "../common/PomodoroCycleBar";
import { NOISE_OPTIONS, NOISE_CATEGORIES } from "../../utils/audioSynthesis";
import { formatTimeFromSeconds } from "../../utils/formatters";
import type { Keyword } from "../../../shared/types/graph";

const getIcon = (iconName: string): React.ReactNode => {
  const icons: Record<string, React.ReactNode> = {
    CloudRain: <CloudRain size={18} />,
    Coffee: <Coffee size={18} />,
    Trees: <Trees size={18} />,
    Waves: <Waves size={18} />,
    Flame: <Flame size={18} />,
    CloudLightning: <CloudLightning size={18} />,
    Droplets: <Droplets size={18} />,
    Wind: <Wind size={18} />,
    BookOpen: <BookOpen size={18} />,
    Moon: <Moon size={18} />,
    Train: <Train size={18} />,
    Plane: <Plane size={18} />,
    Circle: <Circle size={18} />,
    Bell: <Bell size={18} />,
    Activity: <Activity size={18} />,
    Radio: <Radio size={18} />,
  };
  return icons[iconName] || <Volume2 size={18} />;
};

interface LearningFocusPanelProps {
  isOpen: boolean;
  onClose: () => void;
  articleContent: string;
  nodeTitle?: string;
  isMobile?: boolean;
  keywords?: Keyword[];
}

export const LearningFocusPanel: React.FC<LearningFocusPanelProps> = ({
  isOpen,
  onClose,
  articleContent,
  nodeTitle,
  isMobile = false,
  keywords,
}) => {
  const { t } = useTranslation();

  const {
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    highlightEnabled,
    highlightIntensity,
    setHighlightEnabled,
    setHighlightIntensity,
    exitFocusMode,
    currentNodeId,
    longBreakInterval,
  } = useFocusStore(
    useShallow((s) => ({
      focusDuration: s.focusDuration,
      shortBreakDuration: s.shortBreakDuration,
      longBreakDuration: s.longBreakDuration,
      highlightEnabled: s.highlightEnabled,
      highlightIntensity: s.highlightIntensity,
      setHighlightEnabled: s.setHighlightEnabled,
      setHighlightIntensity: s.setHighlightIntensity,
      exitFocusMode: s.exitFocusMode,
      currentNodeId: s.currentNodeId,
      longBreakInterval: s.longBreakInterval,
    })),
  );

  const { recordActivity } = useActivityTracker();
  const sessionStartRef = useRef<string | null>(null);
  const recordActivityRef = useRef(recordActivity);
  useEffect(() => {
    recordActivityRef.current = recordActivity;
  });

  const isActive = useTimerStore((s) => s.isActive);
  const timeLeft = useTimerStore((s) => s.timeLeft);
  const mode = useTimerStore((s) => s.mode);
  const completedSessions = useTimerStore((s) => s.completedSessions);
  const pauseTimer = useTimerStore((s) => s.pause);
  const resumeTimer = useTimerStore((s) => s.resume);
  const resetTimer = useTimerStore((s) => s.reset);
  const skipToNext = useTimerStore((s) => s.skipToNext);

  const {
    mixedNoises,
    activePresetId,
    allPresets,
    analyserData,
    startMixer,
    stopMixer,
    addNoise,
    removeNoise,
    setNoiseVolume,
    clearAllNoises,
    loadPreset,
    saveCurrentAsPreset,
  } = useWhiteNoise();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isSystemDark, setIsSystemDark] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<
    Set<NoiseCategory>
  >(new Set(["nature"]));

  const containerRef = useRef<HTMLDivElement>(null);
  const keywordListRef = useRef<HTMLDivElement>(null);

  const toggleCategory = useCallback((categoryId: NoiseCategory) => {
    setExpandedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setIsSystemDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsSystemDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const handleKeywordClick = useCallback(
    (keyword: {
      term: string;
      importance: number;
      category: string;
      explanation: string;
    }) => {
      setShowSettings(true);
      setTimeout(() => {
        const keywordCards = keywordListRef.current?.querySelectorAll(
          "[data-keyword-term]",
        );
        if (keywordCards) {
          for (const card of keywordCards) {
            if (card.getAttribute("data-keyword-term") === keyword.term) {
              card.scrollIntoView({ behavior: "smooth", block: "center" });
              card.classList.add("ring-2", "ring-primary-400");
              setTimeout(
                () => card.classList.remove("ring-2", "ring-primary-400"),
                2000,
              );
              break;
            }
          }
        }
      }, 300);
    },
    [],
  );

  const getNoiseOption = useCallback((type: WhiteNoiseType) => {
    return NOISE_OPTIONS.find((opt) => opt.id === type);
  }, []);

  useEffect(() => {
    if (isOpen) {
      startMixer();
      sessionStartRef.current = new Date().toISOString();
    }
    return () => {
      stopMixer();
      sessionStartRef.current = null;
    };
  }, [isOpen, startMixer, stopMixer]);

  useEffect(() => {
    let prevCompletedSessions = useTimerStore.getState().completedSessions;
    const unsubscribe = useTimerStore.subscribe((state) => {
      if (
        state.completedSessions > prevCompletedSessions &&
        state.mode !== "focus" &&
        isOpen
      ) {
        const elapsed = state.totalTime - state.timeLeft;
        recordActivityRef.current({
          activity_type: "focus_study",
          title: `专注学习: ${nodeTitle || "知识点"}`,
          started_at: sessionStartRef.current || new Date().toISOString(),
          ended_at: new Date().toISOString(),
          duration: elapsed,
          knowledge_point_id: currentNodeId ?? undefined,
        });
        sessionStartRef.current = new Date().toISOString();
      }
      prevCompletedSessions = state.completedSessions;
    });
    return () => unsubscribe();
  }, [isOpen, nodeTitle, currentNodeId]);

  const handleClose = useCallback(() => {
    if (isActive && mode === "focus" && sessionStartRef.current) {
      const elapsed = Math.round(
        (Date.now() - new Date(sessionStartRef.current).getTime()) / 1000,
      );
      recordActivityRef.current({
        activity_type: "focus_study",
        title: `专注学习: ${nodeTitle || "知识点"}`,
        started_at: sessionStartRef.current,
        ended_at: new Date().toISOString(),
        duration: elapsed,
        knowledge_point_id: currentNodeId ?? undefined,
      });
    }
    stopMixer();
    exitFocusMode();
    onClose();
  }, [
    stopMixer,
    exitFocusMode,
    onClose,
    isActive,
    mode,
    nodeTitle,
    currentNodeId,
  ]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleClose]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
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

  const getProgress = () => {
    let total = focusDuration * 60;
    if (mode === "shortBreak") total = shortBreakDuration * 60;
    else if (mode === "longBreak") total = longBreakDuration * 60;
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
          className="fixed inset-0 z-[100] bg-gradient-to-br from-slate-100 via-slate-50 to-white dark:from-slate-800 dark:via-slate-700 dark:to-slate-800"
        >
          <motion.div
            className="absolute inset-0 opacity-30 pointer-events-none"
            style={{
              background: `radial-gradient(circle at 50% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 60%)`,
            }}
            animate={{
              scale: [1, 1.05, 1],
              opacity: [0.3, 0.4, 0.3],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />

          <div className="absolute top-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-b from-slate-200/90 to-transparent dark:from-slate-900/90 dark:to-transparent z-20">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary-100 dark:bg-primary-500/20 border border-primary-300 dark:border-primary-500/30">
                <Brain
                  size={16}
                  className="text-primary-600 dark:text-primary-400"
                />
                <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">
                  {t("learning.focusMode.title")}
                </span>
              </div>
              {nodeTitle && (
                <div className="hidden sm:flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">
                  <BookOpen size={14} />
                  <span className="max-w-[150px] truncate">{nodeTitle}</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setHighlightEnabled(!highlightEnabled)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  highlightEnabled
                    ? "bg-yellow-100 text-yellow-700 border border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30"
                    : "bg-slate-200 text-slate-600 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
                }`}
              >
                <Highlighter size={14} />
                <span className="hidden sm:inline">
                  {t("learning.focusMode.highlight")}
                </span>
              </button>

              <motion.button
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-lg transition-colors ${showSettings ? "bg-primary-100 text-primary-600 dark:bg-primary-500/30 dark:text-primary-300" : "bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300"}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Settings2 size={16} />
              </motion.button>

              <motion.button
                onClick={() => setIsLocked(!isLocked)}
                className={`p-2 rounded-lg transition-colors ${isLocked ? "bg-primary-100 text-primary-600 dark:bg-primary-500/30 dark:text-primary-300" : "bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300"}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                title={
                  isLocked
                    ? t("learning.focusMode.unlock")
                    : t("learning.focusMode.lock")
                }
              >
                {isLocked ? <Lock size={16} /> : <Unlock size={16} />}
              </motion.button>

              <motion.button
                onClick={toggleFullscreen}
                className="p-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:hover:bg-slate-600 dark:text-slate-300 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {isFullscreen ? (
                  <Minimize2 size={16} />
                ) : (
                  <Maximize2 size={16} />
                )}
              </motion.button>

              <motion.button
                onClick={handleClose}
                aria-label={t('common.aria.close')}
                className="p-2 rounded-lg bg-slate-200 hover:bg-red-100 text-slate-600 hover:text-red-500 dark:bg-slate-700 dark:hover:bg-red-500/30 dark:text-slate-300 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <X size={16} />
              </motion.button>
            </div>
          </div>

          <div className="absolute inset-0 flex overflow-hidden pt-14">
            <div
              className={`flex-1 overflow-y-auto custom-scrollbar ${isMobile ? "p-4" : "p-8 lg:p-12"}`}
            >
              <HighlightedReader
                content={articleContent}
                isDark={isSystemDark}
                isMobile={isMobile}
                keywords={keywords}
                onKeywordClick={handleKeywordClick}
              />
            </div>

            <AnimatePresence>
              {showSettings && (
                <motion.div
                  initial={{ opacity: 0, x: 300 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 300 }}
                  className="w-80 border-l border-slate-200 dark:border-slate-700/50 bg-white/90 dark:bg-slate-900/50 backdrop-blur-sm overflow-y-auto p-4 space-y-6"
                >
                  <div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Brain size={16} className="text-primary-500" />
                      {t("learning.focusMode.timer")}
                    </h3>
                    <div className="space-y-4">
                      <PomodoroCycleBar
                        mode={mode}
                        completedSessions={completedSessions}
                        longBreakInterval={longBreakInterval}
                        size="md"
                      />

                      <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                          <svg aria-hidden="true" className="w-24 h-24 transform -rotate-90">
                            <circle
                              cx="48"
                              cy="48"
                              r="44"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="transparent"
                              className="text-slate-200 dark:text-slate-700"
                            />
                            <circle
                              cx="48"
                              cy="48"
                              r="44"
                              stroke="currentColor"
                              strokeWidth="4"
                              fill="transparent"
                              strokeDasharray={2 * Math.PI * 44}
                              strokeDashoffset={
                                2 * Math.PI * 44 * (1 - getProgress() / 100)
                              }
                              className={`${
                                mode === "focus"
                                  ? "text-primary-500"
                                  : "text-emerald-500"
                              } transition-all duration-1000 ease-linear`}
                              strokeLinecap="round"
                            />
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-xl font-bold font-mono text-slate-800 dark:text-white">
                              {formatTimeFromSeconds(timeLeft)}
                            </span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">
                              {isActive
                                ? t("learning.focusMode.inProgress")
                                : t("learning.focusMode.paused")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={resetTimer}
                            className="p-2 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 transition-colors"
                          >
                            <RotateCcw size={18} />
                          </button>

                          <button
                            onClick={isActive ? pauseTimer : resumeTimer}
                            className={`p-3 rounded-full shadow-lg transform transition-transform active:scale-95 ${
                              isActive
                                ? "bg-amber-100 text-amber-600 hover:bg-amber-200 dark:bg-amber-500/80 dark:text-white dark:hover:bg-amber-500"
                                : "bg-primary-500 text-white hover:bg-primary-600"
                            }`}
                          >
                            {isActive ? (
                              <Pause size={20} fill="currentColor" />
                            ) : (
                              <Play
                                size={20}
                                fill="currentColor"
                                className="ml-0.5"
                              />
                            )}
                          </button>

                          <button
                            onClick={skipToNext}
                            className="p-2 rounded-full bg-slate-200 text-slate-500 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:hover:bg-slate-600 transition-colors"
                          >
                            <SkipForward size={18} />
                          </button>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-500 flex items-center justify-center gap-1">
                          <CheckCircleIcon size={12} />
                          <span>
                            {t("learning.focusMode.sessionsCompleted", {
                              count: completedSessions,
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Highlighter size={16} className="text-yellow-500" />
                      {t("learning.focusMode.smartHighlight")}
                    </h3>
                    <div className="space-y-3">
                      <label className="flex items-center justify-between">
                        <span className="text-sm text-slate-600 dark:text-slate-400">
                          {t("learning.focusMode.enableHighlight")}
                        </span>
                        <input
                          type="checkbox"
                          checked={highlightEnabled}
                          onChange={(e) =>
                            setHighlightEnabled(e.target.checked)
                          }
                          className="w-4 h-4 rounded accent-yellow-500"
                        />
                      </label>
                      {highlightEnabled && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-xs text-slate-500 dark:text-slate-500">
                            <span>
                              {t("learning.focusMode.highlightIntensity")}
                            </span>
                            <span>{Math.round(highlightIntensity * 100)}%</span>
                          </div>
                          <input
                            type="range"
                            min="0.1"
                            max="1"
                            step="0.1"
                            value={highlightIntensity}
                            onChange={(e) =>
                              setHighlightIntensity(parseFloat(e.target.value))
                            }
                            className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-yellow-500"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {keywords && keywords.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                        <Brain size={16} className="text-primary-500" />
                        {t("learning.focusMode.keywords")} ({keywords.length})
                      </h3>
                      <div
                        ref={keywordListRef}
                        className="space-y-2 max-h-60 overflow-y-auto custom-scrollbar"
                      >
                        {keywords.map((keyword, index) => {
                          const importanceColors: Record<number, string> = {
                            5: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30",
                            4: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30",
                            3: "bg-lime-100 text-lime-700 border-lime-300 dark:bg-lime-500/20 dark:text-lime-300 dark:border-lime-500/30",
                            2: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30",
                            1: "bg-primary-100 text-primary-700 border-primary-300 dark:bg-primary-500/20 dark:text-primary-300 dark:border-primary-500/30",
                          };
                          const colorClass =
                            importanceColors[keyword.importance] ||
                            importanceColors[3];

                          return (
                            <div
                              key={index}
                              data-keyword-term={keyword.term}
                              className={`p-2 rounded-lg border ${colorClass}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium text-sm">
                                  {keyword.term}
                                </span>
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/50 dark:bg-white/10">
                                    {keyword.category}
                                  </span>
                                  <span className="text-[10px] font-bold">
                                    ★{keyword.importance}
                                  </span>
                                </div>
                              </div>
                              <p className="text-xs opacity-80 line-clamp-2">
                                {keyword.explanation}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                      <Volume2
                        size={16}
                        className="text-primary-500 dark:text-primary-400"
                      />
                      {t("learning.focusMode.whiteNoise")}
                    </h3>

                    <div className="space-y-4">
                      {NOISE_CATEGORIES.map((category) => (
                        <div key={category.id}>
                          <button
                            onClick={() => toggleCategory(category.id)}
                            className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                          >
                            {expandedCategories.has(category.id) ? (
                              <ChevronDown
                                size={16}
                                className="text-slate-400"
                              />
                            ) : (
                              <ChevronRight
                                size={16}
                                className="text-slate-400"
                              />
                            )}
                            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">
                              {t(
                                `learning.focusMode.noiseCategories.${category.id}`,
                              )}
                            </span>
                          </button>
                          {expandedCategories.has(category.id) && (
                            <div className="grid grid-cols-3 gap-2 mt-2 pl-6">
                              {NOISE_OPTIONS.filter(
                                (n) => n.category === category.id,
                              ).map((option) => (
                                <motion.button
                                  key={option.id}
                                  onClick={() => addNoise(option.id)}
                                  className={`p-2 rounded-lg flex flex-col items-center gap-1 transition-all ${
                                    mixedNoises.some(
                                      (n) => n.type === option.id,
                                    )
                                      ? "bg-primary-100 text-primary-600 border border-primary-300 dark:bg-primary-500/30 dark:text-primary-300 dark:border-primary-500/50"
                                      : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20"
                                  }`}
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                >
                                  {getIcon(option.icon)}
                                  <span className="text-[10px]">
                                    {t(
                                      `learning.focusMode.noiseOptions.${option.id}`,
                                    )}
                                  </span>
                                </motion.button>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {mixedNoises.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1">
                          <Volume2 size={12} />
                          {t("learning.focusMode.currentMix")} (
                          {mixedNoises.length})
                        </h4>
                        <div className="space-y-2">
                          {mixedNoises.map((noise) => {
                            const option = getNoiseOption(noise.type);
                            return (
                              <div
                                key={noise.type}
                                className="flex items-center gap-2 p-2 rounded-lg bg-slate-100 dark:bg-slate-800"
                              >
                                {option && getIcon(option.icon)}
                                <span className="text-xs text-slate-600 dark:text-slate-300 flex-1">
                                  {t(
                                    `learning.focusMode.noiseOptions.${noise.type}`,
                                  )}
                                </span>
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
                                  className="w-16 h-1 bg-slate-200 dark:bg-slate-700 rounded-full appearance-none cursor-pointer accent-primary-500"
                                />
                                <button
                                  onClick={() => removeNoise(noise.type)}
                                  aria-label={t('common.aria.close')}
                                  className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-red-500 transition-colors"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                        <button
                          onClick={clearAllNoises}
                          className="w-full text-xs text-slate-400 hover:text-red-500 py-1 transition-colors"
                        >
                          {t("learning.focusMode.clearAll")}
                        </button>
                      </div>
                    )}

                    <div className="mt-4 space-y-2">
                      <h4 className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        {t("learning.focusMode.presetScenes")}
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {allPresets.map((preset) => (
                          <motion.button
                            key={preset.id}
                            onClick={() => loadPreset(preset)}
                            className={`p-2 rounded-lg text-xs transition-all ${
                              activePresetId === preset.id
                                ? "bg-primary-100 text-primary-600 border border-primary-300 dark:bg-primary-500/30 dark:text-primary-300 dark:border-primary-500/50"
                                : "bg-slate-100 text-slate-500 hover:bg-slate-200 border border-transparent dark:bg-white/10 dark:text-slate-400 dark:hover:bg-white/20"
                            }`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                          >
                            {preset.isBuiltIn
                              ? t(`learning.focusMode.presetNames.${preset.id}`)
                              : preset.name}
                          </motion.button>
                        ))}
                      </div>
                      {mixedNoises.length > 0 && (
                        <button
                          onClick={() => {
                            const name = prompt(
                              t("learning.focusMode.enterPresetName"),
                            );
                            if (name) saveCurrentAsPreset(name);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 p-2 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs transition-colors"
                        >
                          <Save size={14} />
                          {t("learning.focusMode.saveAsPreset")}
                        </button>
                      )}
                    </div>

                    <div className="mt-4">
                      <AudioVisualizer
                        analyserData={analyserData}
                        type="wave"
                        width={260}
                        height={50}
                        className="w-full"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 移除底部计时器面板 */}

          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] pointer-events-none"
            animate={{
              rotate: 360,
            }}
            transition={{
              duration: 60,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <div className="absolute inset-0 rounded-full border border-primary-200/30 dark:border-primary-500/10" />
            <div className="absolute inset-4 rounded-full border border-primary-200/20 dark:border-primary-500/5" />
            <div className="absolute inset-8 rounded-full border border-primary-200/30 dark:border-primary-500/10" />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const CheckCircleIcon = ({ size }: { size: number }) => (
  <svg aria-hidden="true"
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
