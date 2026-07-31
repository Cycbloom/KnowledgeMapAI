import React, { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { TimerMode } from "@shared/types";
import { motion } from "framer-motion";
import { cn } from "@/utils/utils";
import { TIMER_MODE_COLORS, getModeLabel } from "@/constants/timer";
import { useReducedMotionOrPreference } from "@/hooks/common/useReducedMotionOrPreference";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PomodoroCycleBarProps {
  mode: TimerMode;
  completedSessions: number;
  longBreakInterval?: number;
  size?: "sm" | "md";
}

interface Station {
  type: TimerMode;
  /** Global sequence number (0-based, ever-increasing) */
  seq: number;
  /** Focus index within its cycle (0-based) */
  cycleIndex: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate stations for display: some past + current cycle + some future */
function generateVisibleStations(
  mode: TimerMode,
  completedSessions: number,
  longBreakInterval: number,
): { stations: Station[]; currentIdx: number } {
  // Each cycle has: F0, S0, F1, S1, ..., F(n-1), S(n-2), L = 2n stations
  // e.g. interval=4: F0,S0,F1,S1,F2,S2,F3,L = 8 stations
  const stationsPerCycle = longBreakInterval * 2;

  // How many full cycles completed before current cycle
  const currentCycle = Math.floor(completedSessions / longBreakInterval);
  const posInCycle = completedSessions % longBreakInterval;

  // Current station's global sequence
  let currentSeq: number;
  if (mode === "focus") {
    // We're at focus #posInCycle in the current cycle
    currentSeq = currentCycle * stationsPerCycle + posInCycle * 2;
  } else if (mode === "shortBreak") {
    // We're at shortBreak after focus #posInCycle-1
    const breakIdx = Math.max(0, posInCycle - 1);
    currentSeq = currentCycle * stationsPerCycle + breakIdx * 2 + 1;
  } else {
    // longBreak — last station in cycle
    currentSeq = (currentCycle + 1) * stationsPerCycle - 1;
  }

  // Show 3 stations before current + current + rest of cycle + next cycle
  const showBefore = 3;
  const startSeq = Math.max(0, currentSeq - showBefore);
  // Show enough after: at least to end of next cycle
  const endSeq = currentSeq + stationsPerCycle + 2;

  const stations: Station[] = [];
  for (let seq = startSeq; seq <= endSeq; seq++) {
    const posInThisCycle = seq % stationsPerCycle;

    let type: TimerMode;
    let cycleIndex: number;

    if (posInThisCycle === stationsPerCycle - 1) {
      // Last station in cycle = long break
      type = "longBreak";
      cycleIndex = 0;
    } else if (posInThisCycle % 2 === 0) {
      // Even position = focus
      type = "focus";
      cycleIndex = posInThisCycle / 2;
    } else {
      // Odd position = short break
      type = "shortBreak";
      cycleIndex = (posInThisCycle - 1) / 2;
    }

    stations.push({ type, seq, cycleIndex });
  }

  const currentIdx = currentSeq - startSeq;
  return { stations, currentIdx };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const PomodoroCycleBar: React.FC<PomodoroCycleBarProps> = ({
  mode,
  completedSessions,
  longBreakInterval = 4,
  size = "sm",
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isSm = size === "sm";
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  const { stations, currentIdx } = useMemo(
    () => generateVisibleStations(mode, completedSessions, longBreakInterval),
    [mode, completedSessions, longBreakInterval],
  );

  // Dimensions based on size
  const dotR = isSm ? 8 : 11; // dot radius
  const dotD = dotR * 2;
  const connLen = isSm ? 16 : 24; // connector length
  const labelSize = isSm ? "text-[7px]" : "text-[9px]";
  const iconSize = isSm ? 14 : 18;

  // Auto-scroll to center current station
  useEffect(() => {
    if (!scrollRef.current) return;
    const container = scrollRef.current;
    const stationEls = container.querySelectorAll("[data-station]");
    if (stationEls[currentIdx]) {
      const el = stationEls[currentIdx] as HTMLElement;
      const containerWidth = container.clientWidth;
      const elLeft = el.offsetLeft;
      const elWidth = el.offsetWidth;
      container.scrollTo({
        left: elLeft - containerWidth / 2 + elWidth / 2,
        behavior: "smooth",
      });
    }
  }, [currentIdx]);

  const getIcon = (type: TimerMode) => {
    switch (type) {
      case "focus":
        return (
          <svg aria-hidden="true"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      case "shortBreak":
        return (
          <svg aria-hidden="true"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 8h1a4 4 0 1 1 0 8h-1" />
            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V8z" />
            <line x1="6" y1="2" x2="6" y2="4" />
            <line x1="10" y1="2" x2="10" y2="4" />
            <line x1="14" y1="2" x2="14" y2="4" />
          </svg>
        );
      case "longBreak":
        return (
          <svg aria-hidden="true"
            width={iconSize}
            height={iconSize}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2c1 3 4 5.5 4 8.5a4 4 0 1 1-8 0c0-3 3-5.5 4-8.5z" />
          </svg>
        );
    }
  };

  return (
    <div className="relative w-full overflow-hidden">
      {/* Left fade mask */}
      <div className="absolute left-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-r from-white dark:from-slate-800 to-transparent pointer-events-none" />

      {/* Scrollable track */}
      <div
        ref={scrollRef}
        className="flex items-center overflow-x-auto scrollbar-none"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        <div
          className="flex items-center"
          style={{
            minWidth: "fit-content",
            paddingLeft: "calc(50% - 12px)",
            paddingRight: "50%",
            paddingBottom: isSm ? 14 : 18,
          }}
        >
          {stations.map((station, idx) => {
            const isCompleted = idx < currentIdx;
            const isCurrent = idx === currentIdx;
            const isNearFuture = idx > currentIdx && idx <= currentIdx + 2;
            const isFarFuture = idx > currentIdx + 2;
            const color = TIMER_MODE_COLORS[station.type].primary;

            // Opacity for depth effect
            const opacity = isFarFuture ? 0.3 : isNearFuture ? 0.6 : 1;

            return (
              <React.Fragment key={station.seq}>
                {/* Connector line */}
                {idx > 0 && (
                  <div
                    className="flex-shrink-0 relative"
                    style={{ width: connLen, height: 2 }}
                    role="progressbar"
                    aria-label={t('common.aria.pomodoroProgress')}
                    aria-valuenow={(isCompleted || isCurrent) ? 100 : 0}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    {/* Background track */}
                    <div className="absolute inset-0 rounded-full bg-gray-200 dark:bg-slate-700" />
                    {/* Filled portion — green if previous station is completed or current */}
                    {(isCompleted || isCurrent) && (
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ backgroundColor: "#10b981" }}
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: "100%" }}
                        transition={transitionOverride ?? { duration: 0.4, ease: "easeOut" }}
                      />
                    )}
                  </div>
                )}

                {/* Station dot with label positioned below without affecting layout */}
                <div
                  data-station
                  className="flex-shrink-0 relative"
                  style={{ opacity }}
                >
                  <div
                    className="relative rounded-full flex items-center justify-center transition-all duration-500"
                    style={{
                      width: isCurrent ? dotD + 4 : dotD,
                      height: isCurrent ? dotD + 4 : dotD,
                      backgroundColor: isCompleted
                        ? "#10b981"
                        : isCurrent
                          ? color
                          : TIMER_MODE_COLORS[station.type].bgLight,
                      border: isCompleted
                        ? "none"
                        : isCurrent
                          ? `2px solid ${color}`
                          : `1.5px solid ${isNearFuture ? "#9ca3af" : "#d1d5db"}`,
                      boxShadow: isCurrent
                        ? `0 0 12px ${color}50, 0 0 4px ${color}30`
                        : "none",
                    }}
                  >
                    {/* Completed: checkmark */}
                    {isCompleted && (
                      <svg aria-hidden="true"
                        width={iconSize - 2}
                        height={iconSize - 2}
                        viewBox="0 0 12 12"
                        fill="none"
                      >
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="white"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}

                    {/* Current: icon */}
                    {isCurrent && (
                      <span style={{ color: "white" }}>
                        {getIcon(station.type)}
                      </span>
                    )}

                    {/* Future: smaller dot */}
                    {!isCompleted && !isCurrent && (
                      <div
                        className="rounded-full"
                        style={{
                          width: dotR - 2,
                          height: dotR - 2,
                          backgroundColor: isNearFuture ? color : "#d1d5db",
                          opacity: isNearFuture ? 0.5 : 0.3,
                        }}
                      />
                    )}

                    {/* Pulse ring for current */}
                    {isCurrent && !reduceMotion && (
                      <motion.div
                        className="absolute inset-0 rounded-full pointer-events-none"
                        style={{ border: `2px solid ${color}` }}
                        animate={{
                          scale: [1, 1.4, 1],
                          opacity: [0.6, 0, 0.6],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "easeInOut",
                        }}
                      />
                    )}
                  </div>

                  {/* Label — absolutely positioned below dot so it doesn't affect flex alignment */}
                  <span
                    className={cn('absolute left-1/2 -translate-x-1/2', labelSize, 'leading-none select-none whitespace-nowrap',
                      isCompleted
                        ? "text-emerald-500"
                        : isCurrent
                          ? "font-semibold text-gray-700 dark:text-gray-200"
                          : "text-gray-400 dark:text-gray-500"
                    )}
                    style={{ top: isCurrent ? dotD + 6 : dotD + 4 }}
                  >
                    {getModeLabel(station.type, t)}
                  </span>
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* Right fade mask */}
      <div className="absolute right-0 top-0 bottom-0 w-6 z-10 bg-gradient-to-l from-white dark:from-slate-800 to-transparent pointer-events-none" />
    </div>
  );
};
