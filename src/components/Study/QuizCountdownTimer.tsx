import React from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";

interface QuizCountdownTimerProps {
  remaining: number;
  totalSeconds: number;
  isDark: boolean;
  isMobile: boolean;
}

/**
 * 每题限时倒计时指示器：
 * - 剩余秒数 + 细进度条
 * - 最后 5 秒转为警示色（红）
 * - totalSeconds<=0 时隐藏（未开启）
 */
export const QuizCountdownTimer: React.FC<QuizCountdownTimerProps> = ({
  remaining,
  totalSeconds,
  isDark,
  isMobile,
}) => {
  const { t } = useTranslation();
  if (totalSeconds <= 0) return null;

  const ratio = Math.max(0, Math.min(1, remaining / totalSeconds));
  const urgent = remaining <= 5;

  return (
    <div
      className={`flex items-center gap-2 ${isMobile ? "px-3" : "px-3"} py-1.5 rounded-lg border ${
        urgent
          ? isDark
            ? "bg-red-900/30 border-red-500/60 text-red-300"
            : "bg-red-50 border-red-300 text-red-600"
          : isDark
            ? "bg-slate-800 border-slate-700 text-slate-300"
            : "bg-white border-gray-200 text-gray-600"
      }`}
      role="timer"
      aria-live={urgent ? "assertive" : "off"}
    >
      <Clock
        size={isMobile ? 16 : 15}
        aria-hidden="true"
        className={urgent ? "text-red-500 animate-pulse" : "text-primary-500"}
      />
      <span className={`font-bold tabular-nums ${isMobile ? "text-sm" : "text-xs"}`}>
        {remaining}s
      </span>
      <span className="sr-only">{t("study.settings.timerSeconds")}</span>
      <span
        className={`h-1.5 flex-1 rounded-full overflow-hidden ${
          isDark ? "bg-slate-700" : "bg-gray-200"
        }`}
      >
        <span
          className={`block h-full rounded-full transition-all duration-1000 ${
            urgent
              ? "bg-red-500"
              : ratio > 0.5
                ? "bg-primary-500"
                : "bg-amber-500"
          }`}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
    </div>
  );
};