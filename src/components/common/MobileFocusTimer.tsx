import React, { useState, useEffect, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useFocusStore } from "../../store/useFocusStore";
import type { TimerMode } from "@shared/types";
import { useTimerStore } from "../../store/useTimerStore";
import { PomodoroCycleBar } from "./PomodoroCycleBar";
import {
  Play,
  Pause,
  RotateCcw,
  Coffee,
  Brain,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

const getModeColor = (m: TimerMode) => {
  switch (m) {
    case "focus":
      return {
        primary: "#3b82f6",
        secondary: "#1d4ed8",
        bg: "rgba(59, 130, 246, 0.15)",
      };
    case "shortBreak":
      return {
        primary: "#10b981",
        secondary: "#059669",
        bg: "rgba(16, 185, 129, 0.15)",
      };
    case "longBreak":
      return {
        primary: "#8b5cf6",
        secondary: "#7c3aed",
        bg: "rgba(139, 92, 246, 0.15)",
      };
  }
};

const BALL_SIZE = 52;
const COLLAPSED_WIDTH = 28;
const PANEL_WIDTH = 220;
const SCREEN_MARGIN = 8;

export const MobileFocusTimer: React.FC = () => {
  const { t } = useTranslation();
  const { focusDuration, isInFocusMode, longBreakInterval } = useFocusStore();

  const timeLeft = useTimerStore((s) => s.timeLeft);
  const mode = useTimerStore((s) => s.mode);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  const progress = useTimerStore((s) => s.progress);
  const completedSessions = useTimerStore((s) => s.completedSessions);

  const isRunning = isActive && !isPaused;

  const [isExpanded, setIsExpanded] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [ballY, setBallY] = useState(150);
  const [isOnRight, setIsOnRight] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const lastTapRef = useRef<number>(0);
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const getModeLabel = (m: TimerMode) => {
    switch (m) {
      case "focus":
        return t("focusTimer.focus");
      case "shortBreak":
        return t("focusTimer.shortBreak");
      case "longBreak":
        return t("focusTimer.longBreak");
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem("mobileFocusTimerState");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBallY(parsed.ballY || 150);
        setIsOnRight(parsed.isOnRight !== undefined ? parsed.isOnRight : true);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "mobileFocusTimerState",
      JSON.stringify({ ballY, isOnRight }),
    );
  }, [ballY, isOnRight]);

  const handleDragStart = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(true);
      dragStartPos.current = { x: info.point.x, y: info.point.y };
    },
    [],
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      setIsDragging(false);

      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;

      const newIsOnRight = info.point.x > screenWidth / 2;
      setIsOnRight(newIsOnRight);

      const newY = Math.max(
        80,
        Math.min(screenHeight - BALL_SIZE - 100, info.point.y - BALL_SIZE / 2),
      );
      setBallY(newY);

      dragStartPos.current = null;
    },
    [],
  );

  const handleBallClick = useCallback(() => {
    if (isDragging) return;

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      if (isRunning) {
        useTimerStore.getState().pause();
      } else if (timeLeft === focusDuration * 60 && mode === "focus") {
        useTimerStore.getState().start("manual", focusDuration);
      } else {
        useTimerStore.getState().resume();
      }
      lastTapRef.current = 0;
    } else {
      lastTapRef.current = now;
      if (isCollapsed) {
        setIsCollapsed(false);
      } else if (isExpanded) {
        setIsExpanded(false);
      } else {
        setIsExpanded(true);
      }
    }
  }, [
    isDragging,
    isCollapsed,
    isExpanded,
    isRunning,
    timeLeft,
    focusDuration,
    mode,
  ]);

  const handleCollapse = useCallback(() => {
    setIsCollapsed(true);
    setIsExpanded(false);
  }, []);

  const handleExpandFromCollapsed = useCallback(() => {
    setIsCollapsed(false);
    setIsExpanded(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsExpanded(false);
  }, []);

  const handleStartPause = useCallback(() => {
    if (isRunning) {
      useTimerStore.getState().pause();
    } else if (timeLeft === focusDuration * 60 && mode === "focus") {
      useTimerStore.getState().start("manual", focusDuration);
    } else {
      useTimerStore.getState().resume();
    }
  }, [isRunning, timeLeft, focusDuration, mode]);

  const handleReset = useCallback(() => {
    useTimerStore.getState().reset();
  }, []);

  if (isInFocusMode) {
    return null;
  }

  const colors = getModeColor(mode);
  const progressValue = progress;
  const circumference = 2 * Math.PI * 22;
  const strokeDashoffset = circumference * (1 - progressValue / 100);

  return (
    <>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            key="panel"
            initial={{ x: isOnRight ? PANEL_WIDTH : -PANEL_WIDTH, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: isOnRight ? PANEL_WIDTH : -PANEL_WIDTH, opacity: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed z-[99] bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-slate-700 overflow-hidden"
            style={{
              width: PANEL_WIDTH,
              top: Math.max(60, Math.min(ballY - 80, window.innerHeight - 340)),
              [isOnRight ? "right" : "left"]: SCREEN_MARGIN,
            }}
          >
            <div
              className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-slate-700"
              style={{ backgroundColor: colors.bg }}
            >
              <div className="flex items-center gap-2">
                {mode === "focus" ? (
                  <Brain size={16} color={colors.primary} />
                ) : (
                  <Coffee size={16} color={colors.primary} />
                )}
                <span
                  className="text-sm font-semibold"
                  style={{ color: colors.primary }}
                >
                  {getModeLabel(mode)}
                  {t("focusTimer.mode")}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCollapse}
                  className="p-1.5 rounded-full hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
                  title={t("focusTimer.collapseToSide")}
                >
                  {isOnRight ? (
                    <ChevronRight size={16} className="text-gray-500" />
                  ) : (
                    <ChevronLeft size={16} className="text-gray-500" />
                  )}
                </button>
                <button
                  onClick={closePanel}
                  className="p-1.5 rounded-full hover:bg-white/50 dark:hover:bg-slate-700/50 transition-colors"
                  title={t("focusTimer.close")}
                >
                  <X size={16} className="text-gray-500" />
                </button>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3">
                <PomodoroCycleBar
                  mode={mode}
                  completedSessions={completedSessions}
                  longBreakInterval={longBreakInterval}
                  size="sm"
                />
              </div>

              <span
                className="block text-center text-xs font-medium mb-3"
                style={{ color: colors.primary }}
              >
                {getModeLabel(mode)}
              </span>

              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg
                  className="w-full h-full transform -rotate-90"
                  viewBox="0 0 100 100"
                >
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke="currentColor"
                    strokeWidth="6"
                    fill="transparent"
                    className="text-gray-100 dark:text-slate-700"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="44"
                    stroke={colors.primary}
                    strokeWidth="6"
                    fill="transparent"
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={
                      2 * Math.PI * 44 * (1 - progressValue / 100)
                    }
                    strokeLinecap="round"
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-mono text-gray-800 dark:text-white">
                    {formatTime(timeLeft)}
                  </span>
                  <span className="text-xs text-gray-400 mt-1">
                    {isRunning
                      ? mode === "focus"
                        ? t("focusTimer.inProgress")
                        : t("focusTimer.breakInProgress")
                      : t("focusTimer.paused")}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={handleReset}
                  className="p-2.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <RotateCcw size={18} />
                </button>

                <motion.button
                  onClick={handleStartPause}
                  className="p-4 rounded-full shadow-lg"
                  style={{ backgroundColor: colors.primary }}
                  whileTap={{ scale: 0.95 }}
                >
                  {isRunning ? (
                    <Pause size={22} fill="white" color="white" />
                  ) : (
                    <Play
                      size={22}
                      fill="white"
                      color="white"
                      className="ml-0.5"
                    />
                  )}
                </motion.button>

                <button
                  onClick={() => useTimerStore.getState().skipToNext()}
                  className="p-2.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polygon points="5 4 15 12 5 20 5 4" />
                    <line x1="19" y1="5" x2="19" y2="19" />
                  </svg>
                </button>
              </div>

              <div className="mt-4 text-center text-xs text-gray-400">
                {t("focusTimer.sessionsCompleted", {
                  count: completedSessions,
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="fixed z-[100] touch-none select-none"
        style={{
          top: ballY,
          [isOnRight ? "right" : "left"]: isCollapsed ? 0 : SCREEN_MARGIN,
        }}
        drag
        dragMomentum={false}
        dragElastic={0}
        dragConstraints={{ top: 0, bottom: 0, left: 0, right: 0 }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        whileDrag={{ scale: 1.1 }}
      >
        <AnimatePresence mode="wait">
          {isCollapsed ? (
            <motion.div
              key="collapsed"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative cursor-pointer"
              onClick={handleExpandFromCollapsed}
            >
              <div
                className="flex items-center justify-center overflow-hidden shadow-lg"
                style={{
                  width: COLLAPSED_WIDTH,
                  height: BALL_SIZE,
                  borderRadius: isOnRight ? "14px 0 0 14px" : "0 14px 14px 0",
                  backgroundColor: colors.bg,
                  border: `2px solid ${colors.primary}`,
                  borderRight: isOnRight
                    ? "none"
                    : `2px solid ${colors.primary}`,
                  borderLeft: isOnRight
                    ? `2px solid ${colors.primary}`
                    : "none",
                }}
              >
                <svg
                  width="28"
                  height="52"
                  viewBox="0 0 28 52"
                  className="absolute"
                >
                  <circle
                    cx="14"
                    cy="26"
                    r="10"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2"
                    opacity="0.3"
                  />
                  <circle
                    cx="14"
                    cy="26"
                    r="10"
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2"
                    strokeDasharray={2 * Math.PI * 10}
                    strokeDashoffset={
                      2 * Math.PI * 10 * (1 - progressValue / 100)
                    }
                    strokeLinecap="round"
                    transform="rotate(-90 14 26)"
                  />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center">
                  {mode === "focus" ? (
                    <Brain size={14} color={colors.primary} />
                  ) : (
                    <Coffee size={14} color={colors.primary} />
                  )}
                  <span
                    className="text-[8px] font-mono font-bold mt-0.5"
                    style={{ color: colors.primary }}
                  >
                    {formatTime(timeLeft).slice(3)}
                  </span>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="ball"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative cursor-pointer"
              onClick={handleBallClick}
            >
              <div
                className="relative flex items-center justify-center rounded-full shadow-lg"
                style={{
                  width: BALL_SIZE,
                  height: BALL_SIZE,
                  backgroundColor: colors.bg,
                  border: `2px solid ${colors.primary}`,
                }}
              >
                <svg
                  width={BALL_SIZE}
                  height={BALL_SIZE}
                  viewBox={`0 0 ${BALL_SIZE} ${BALL_SIZE}`}
                  className="absolute"
                >
                  <circle
                    cx={BALL_SIZE / 2}
                    cy={BALL_SIZE / 2}
                    r={22}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.5"
                    opacity="0.3"
                  />
                  <circle
                    cx={BALL_SIZE / 2}
                    cy={BALL_SIZE / 2}
                    r={22}
                    fill="none"
                    stroke={colors.primary}
                    strokeWidth="2.5"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${BALL_SIZE / 2} ${BALL_SIZE / 2})`}
                  />
                </svg>
                <div className="relative z-10 flex flex-col items-center justify-center">
                  {mode === "focus" ? (
                    <Brain size={18} color={colors.primary} />
                  ) : (
                    <Coffee size={18} color={colors.primary} />
                  )}
                  <span
                    className="text-[10px] font-mono font-bold mt-0.5"
                    style={{ color: colors.primary }}
                  >
                    {formatTime(timeLeft)}
                  </span>
                </div>
              </div>

              {isRunning && (
                <motion.div
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: `2px solid ${colors.primary}` }}
                  animate={{
                    scale: [1, 1.15, 1],
                    opacity: [0.6, 0, 0.6],
                  }}
                  transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                />
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </>
  );
};
