import { useEffect, useRef, useState } from "react";

interface UseCardCountdownParams {
  /** 每题倒计时总秒数；0 表示关闭 */
  totalSeconds: number;
  /** 是否处于作答阶段（!showAnswer）；非作答阶段不计时 */
  active: boolean;
  /** 卡片 id，切换卡片时重置倒计时 */
  cardId: string;
  /** 倒计时归零（超时）回调，用于自动显示答案 */
  onTimeUp: () => void;
}

interface UseCardCountdownResult {
  /** 当前剩余秒数 */
  remaining: number;
}

/**
 * 每题限时倒计时 Hook。
 * - 卡片切换 / 总时长变化 / 进入非作答阶段时重置剩余时间。
 * - 归零时触发 onTimeUp（父级据此自动显示答案，视为超时未答）。
 * - 通过 ref 持有剩余值与回调，避免每秒重建 interval。
 */
export function useCardCountdown({
  totalSeconds,
  active,
  cardId,
  onTimeUp,
}: UseCardCountdownParams): UseCardCountdownResult {
  const [remaining, setRemaining] = useState(totalSeconds);
  const remainingRef = useRef(totalSeconds);
  const onTimeUpRef = useRef(onTimeUp);

  // 同步最新回调，避免在 render 期间写 ref（react-hooks/refs）
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  // 切换卡片 / 时长调整 / 关闭时重置
  useEffect(() => {
    remainingRef.current = totalSeconds;
    setRemaining(totalSeconds);
  }, [cardId, totalSeconds]);

  // 作答阶段逐秒倒计时
  useEffect(() => {
    if (!active || totalSeconds <= 0) return;
    const id = window.setInterval(() => {
      remainingRef.current -= 1;
      if (remainingRef.current <= 0) {
        remainingRef.current = 0;
        window.clearInterval(id);
        onTimeUpRef.current();
      }
      setRemaining(remainingRef.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [active, totalSeconds, cardId]);

  return { remaining };
}