import React from "react";
import { useTranslation } from "react-i18next";
import { Clock } from "lucide-react";
import { useCardCountdown } from "../../hooks/study/useCardCountdown";

interface QuizCountdownTimerProps {
  /** 每题倒计时总秒数；0 表示关闭 */
  totalSeconds: number;
  /** 是否处于作答阶段（!showAnswer）；非作答阶段不计时 */
  active: boolean;
  /** 卡片 id，切换卡片时重置倒计时 */
  cardId: string;
  isDark: boolean;
  isMobile: boolean;
  /** 倒计时归零（超时）回调，用于自动显示答案 */
  onTimeUp: () => void;
}

/**
 * 每题限时倒计时指示器：
 * - 内部持有倒计时 state，每秒只重渲染自身，避免闪卡拖拽/作答时整棵子树抖动
 * - 剩余秒数 + 细进度条
 * - 最后 5 秒转为警示色（红）
 * - totalSeconds<=0 时隐藏（未开启）
 */
export const QuizCountdownTimer: React.FC<QuizCountdownTimerProps> = ({
  totalSeconds,
  active,
  cardId,
  isDark,
  isMobile,
  onTimeUp,
}) => {
  const { t } = useTranslation();
  const { remaining } = useCardCountdown({
    totalSeconds,
    active,
    cardId,
    onTimeUp,
  });

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
