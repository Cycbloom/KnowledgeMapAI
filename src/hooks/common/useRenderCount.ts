import { useRef, useEffect } from 'react';

export interface UseRenderCountResult {
  count: number;
  interval: number;
}

/**
 * 在开发模式下统计组件渲染次数和渲染间隔时间。
 * 生产环境返回 dummy 值，零开销。
 *
 * @param showLabel - 是否在控制台输出渲染次数标签（默认 false），仅用于调试
 */
export function useRenderCount(showLabel: boolean = false): UseRenderCountResult {
  if (!import.meta.env.DEV) {
    return { count: 0, interval: 0 };
  }

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const countRef = useRef(0);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const lastRenderTimeRef = useRef(performance.now());

  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    const now = performance.now();
    const prevTime = lastRenderTimeRef.current;
    lastRenderTimeRef.current = now;
    countRef.current += 1;

    if (showLabel) {
      console.warn(
        `[RenderCount] Render #${countRef.current} (interval: ${(now - prevTime).toFixed(2)}ms)`
      );
    }
  });

  return {
    count: countRef.current,
    interval: performance.now() - lastRenderTimeRef.current,
  };
}