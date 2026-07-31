import React, { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/utils/utils";
import { useFocusStore } from "../../store/useFocusStore";
import { useShallow } from "zustand/react/shallow";
import { useTimerStore } from "../../store/useTimerStore";
import { PomodoroCycleBar } from "./PomodoroCycleBar";
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain,
  Settings2,
  Minimize2,
  Volume2,
  VolumeX,
  SkipForward,
} from "lucide-react";
import { motion, AnimatePresence, useDragControls } from "framer-motion";
import { formatTimeFromSeconds, formatIsoDuration } from "@/utils/formatters";
import { getModeLabel } from "@/constants/timer";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";

export const FocusTimer: React.FC = () => {
  const { t } = useTranslation();
  const {
    focusDuration,
    shortBreakDuration,
    longBreakDuration,
    longBreakInterval,
    soundEnabled,
    updateSettings,
    isInFocusMode,
  } = useFocusStore(
    useShallow((s) => ({
      focusDuration: s.focusDuration,
      shortBreakDuration: s.shortBreakDuration,
      longBreakDuration: s.longBreakDuration,
      longBreakInterval: s.longBreakInterval,
      soundEnabled: s.soundEnabled,
      updateSettings: s.updateSettings,
      isInFocusMode: s.isInFocusMode,
    })),
  );

  const timeLeft = useTimerStore((s) => s.timeLeft);
  const mode = useTimerStore((s) => s.mode);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const progress = useTimerStore((s) => s.progress);
  const completedSessions = useTimerStore((s) => s.completedSessions);

  const isRunning = isActive && !isPaused;
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const dragControls = useDragControls();
  const isDragging = useRef(false);

  const handleStartPause = () => {
    if (isRunning) {
      useTimerStore.getState().pause();
    } else if (timeLeft === focusDuration * 60 && mode === "focus") {
      useTimerStore.getState().start("manual", focusDuration);
    } else {
      useTimerStore.getState().resume();
    }
  };

  const handleReset = () => {
    useTimerStore.getState().reset();
  };

  const handleSkip = () => {
    useTimerStore.getState().skipToNext();
  };

  if (isInFocusMode) {
    return null;
  }

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      onDragStart={() => {
        isDragging.current = true;
      }}
      onDragEnd={() => {
        setTimeout(() => {
          isDragging.current = false;
        }, 100);
      }}
      layout
      initial={false}
      transition={transitionOverride}
      className={cn(
        "fixed z-50 shadow-xl border border-gray-200 dark:border-slate-500 bg-white dark:bg-slate-800 overflow-hidden",
        isExpanded
          ? "rounded-2xl w-72"
          : "rounded-full hover:shadow-2xl transition-shadow"
      )}
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
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={transitionOverride}
            role="button"
            tabIndex={0}
            aria-label={t("common.aria.dragHandle")}
            className="flex items-center gap-2 p-2 cursor-pointer"
            onPointerDown={(e) => dragControls.start(e)}
            onClick={() => {
              if (!isDragging.current) {
                setIsExpanded(!isExpanded);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                setIsExpanded(!isExpanded);
              }
            }}
          >
            <div
              className={cn("p-2 rounded-full", isRunning ? "bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400" : "bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-400")}
            >
              {mode === "focus" ? <Brain size={20} /> : <Coffee size={20} />}
            </div>
            <div className="flex flex-col pr-2">
              <time
                dateTime={formatIsoDuration(timeLeft)}
                className="text-sm font-bold font-mono text-gray-800 dark:text-gray-200 select-none"
              >
                {formatTimeFromSeconds(timeLeft)}
              </time>
              {isRunning && (
                <span className="text-[10px] text-gray-500 dark:text-gray-400 select-none">
                  {t("focusTimer.inProgress")}...
                </span>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="expanded"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
            transition={transitionOverride}
          >
            <div
              role="button"
              tabIndex={0}
              aria-label={t("common.aria.dragHandle")}
              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-100 dark:border-slate-500 cursor-move"
              onPointerDown={(e) => dragControls.start(e)}
              onKeyDown={(e) => {
                if (e.key === " " || e.key === "Enter") {
                  e.preventDefault();
                }
              }}
            >
              <div className="flex items-center gap-2 pointer-events-none">
                <Brain className="text-primary-500" size={18} />
                <span className="font-semibold text-gray-700 dark:text-gray-200 select-none">
                  {t("focusTimer.focusMode")}
                </span>
              </div>
              <div
                className="flex items-center gap-1"
                onPointerDown={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  aria-label={t("common.aria.settings")}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500"
                >
                  <Settings2 size={16} />
                </button>
                <button
                  onClick={() => setIsExpanded(false)}
                  aria-label={t("common.aria.minimize")}
                  className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg text-gray-500"
                >
                  <Minimize2 size={16} />
                </button>
              </div>
            </div>

            {showSettings ? (
              <div className="p-4 space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("focusTimer.focusDuration")}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="60"
                    value={focusDuration}
                    onChange={(e) =>
                      updateSettings({
                        focusDuration: parseInt(e.target.value),
                      })
                    }
                    aria-label={t("focusTimer.focusDuration")}
                    aria-valuetext={t("common.aria.minutesValue", {
                      minutes: focusDuration,
                    })}
                    className="w-full accent-primary-500"
                  />
                  <div className="flex justify-between text-xs text-gray-400 dark:text-gray-500">
                    <span>1</span>
                    <span>{focusDuration}</span>
                    <span>60</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("focusTimer.breakDuration")}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      value={shortBreakDuration}
                      onChange={(e) =>
                        updateSettings({
                          shortBreakDuration: parseInt(e.target.value),
                        })
                      }
                      aria-label={t("focusTimer.shortBreakLabel")}
                      className="w-1/2 p-2 rounded border dark:bg-slate-700 dark:border-slate-500 text-sm"
                      placeholder={t("focusTimer.shortBreakLabel")}
                    />
                    <input
                      type="number"
                      value={longBreakDuration}
                      onChange={(e) =>
                        updateSettings({
                          longBreakDuration: parseInt(e.target.value),
                        })
                      }
                      className="w-1/2 p-2 rounded border dark:bg-slate-700 dark:border-slate-500 text-sm"
                      placeholder={t("focusTimer.longBreakLabel")}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-sm text-gray-600 dark:text-gray-300">
                    {t("focusTimer.soundEnabled")}
                  </span>
                  <button
                    onClick={() =>
                      updateSettings({ soundEnabled: !soundEnabled })
                    }
                    aria-label={t("focusTimer.soundEnabled")}
                    className={cn("p-2 rounded-lg", soundEnabled ? "bg-primary-100 text-primary-600" : "bg-gray-100 text-gray-400 dark:text-gray-500")}
                  >
                    {soundEnabled ? (
                      <Volume2 size={18} />
                    ) : (
                      <VolumeX size={18} />
                    )}
                  </button>
                </div>

                <button
                  onClick={() => setShowSettings(false)}
                  className="w-full py-2 mt-2 text-sm bg-gray-100 dark:bg-slate-700 rounded-lg hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  {t("focusTimer.done")}
                </button>
              </div>
            ) : (
              <div className="p-6 flex flex-col items-center">
                {/* Cycle Progress */}
                <div className="mb-4 w-full">
                  <PomodoroCycleBar
                    mode={mode}
                    completedSessions={completedSessions}
                    longBreakInterval={longBreakInterval}
                    size="sm"
                  />
                </div>

                {/* Current Mode Label */}
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                  {getModeLabel(mode, t)}
                </span>

                {/* Timer Display */}
                <div className="relative mb-6">
                  <svg aria-hidden="true" className="w-48 h-48 transform -rotate-90">
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
                      strokeDashoffset={2 * Math.PI * 88 * (1 - progress / 100)}
                      className={cn(
                        mode === "focus"
                          ? "text-primary-500"
                          : "text-emerald-500",
                        "transition-all duration-1000 ease-linear"
                      )}
                      strokeLinecap="round"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <time
                      dateTime={formatIsoDuration(timeLeft)}
                      className="text-4xl font-bold font-mono text-gray-800 dark:text-white"
                    >
                      {formatTimeFromSeconds(timeLeft)}
                    </time>
                    <span className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                      {isRunning
                        ? mode === "focus"
                          ? t("focusTimer.inProgress")
                          : t("focusTimer.breakInProgress")
                        : t("focusTimer.paused")}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button
                    onClick={handleReset}
                    aria-label={t('common.focusTimer.reset')}
                    className="p-3 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <RotateCcw size={20} />
                  </button>

                  <button
                    onClick={handleStartPause}
                    aria-label={isRunning ? t('common.focusTimer.pause') : t('common.focusTimer.start')}
                    className={cn(
                      "p-4 rounded-full shadow-lg transform transition-transform active:scale-95",
                      isRunning
                        ? "bg-amber-100 text-amber-600 hover:bg-amber-200"
                        : "bg-primary-600 text-white hover:bg-primary-700"
                    )}
                  >
                    {isRunning ? (
                      <Pause size={28} fill="currentColor" />
                    ) : (
                      <Play size={28} fill="currentColor" className="ml-1" />
                    )}
                  </button>

                  <button
                    onClick={handleSkip}
                    aria-label={t('common.focusTimer.skip')}
                    className="p-3 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                  >
                    <SkipForward size={20} />
                  </button>
                </div>

                <div className="mt-6 text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <CheckCircleIcon size={12} />
                  <span>
                    {t("focusTimer.sessionsCompleted", {
                      count: completedSessions,
                    })}
                  </span>
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
