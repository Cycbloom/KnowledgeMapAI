import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

interface UseAutoScrollOptions {
  /** 总开关：关闭时不可启动，运行中自动停止 */
  enabled: boolean;
  /** 滚动速度（px/秒） */
  speed: number;
}

interface UseAutoScrollResult<T extends HTMLElement> {
  /** 绑定到滚动容器 */
  scrollRef: RefObject<T>;
  /** 是否正在自动滚动 */
  active: boolean;
  /** 开始/暂停切换 */
  toggle: () => void;
  /** 停止自动滚动 */
  stop: () => void;
}

/**
 * 阅读器自动向下滑页：按固定速度（px/秒）平滑滚动到底后自动停止。
 * 用户滚轮 / 触摸 / 键盘滚动时立即暂停，避免与手动阅读打架。
 *
 * @example
 * const { scrollRef, active, toggle } = useAutoScroll<HTMLDivElement>({ enabled, speed });
 * return <div ref={scrollRef}>{content}</div>;
 */
export function useAutoScroll<T extends HTMLElement>({
  enabled,
  speed,
}: UseAutoScrollOptions): UseAutoScrollResult<T> {
  const scrollRef = useRef<T>(null);
  const [active, setActive] = useState(false);
  const activeRef = useRef(false);
  const enabledRef = useRef(enabled);
  const speedRef = useRef(speed);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);

  const stop = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    if (!enabledRef.current) return;
    if (activeRef.current) return;
    const el = scrollRef.current;
    if (!el) return;
    const container = el;
    activeRef.current = true;
    setActive(true);
    lastTimeRef.current = 0;

    function step(time: number): void {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = time;
        rafRef.current = requestAnimationFrame(step);
        return;
      }
      const dt = Math.min(64, time - lastTimeRef.current);
      lastTimeRef.current = time;
      const maxScroll = container.scrollHeight - container.clientHeight;
      if (maxScroll <= 0) {
        stop();
        return;
      }
      const next = Math.min(maxScroll, container.scrollTop + (speedRef.current * dt) / 1000);
      container.scrollTop = next;
      if (next < maxScroll) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        stop();
      }
    }

    rafRef.current = requestAnimationFrame(step);
  }, [stop]);

  const toggle = useCallback(() => {
    if (activeRef.current) stop();
    else start();
  }, [start, stop]);

  useEffect(() => {
    enabledRef.current = enabled;
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const pause = (e: Event) => {
      if (!activeRef.current) return;
      const el = scrollRef.current;
      if (el === null) return;
      if (e.target instanceof Node && el.contains(e.target)) stop();
    };
    document.addEventListener("wheel", pause, { passive: true });
    document.addEventListener("touchstart", pause, { passive: true });
    return () => {
      document.removeEventListener("wheel", pause);
      document.removeEventListener("touchstart", pause);
    };
  }, [stop]);

  useEffect(() => stop, [stop]);

  return { scrollRef, active, toggle, stop };
}
