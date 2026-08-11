import React, { useEffect, useRef, useState } from "react";
import { useIsMobile } from "../common/useIsMobile";

const PULL_THRESHOLD = 60;
const MAX_PULL_DISTANCE = 120;

interface UsePullToRefreshOptions {
  /** 刷新回调 */
  onRefresh: () => void | Promise<void>;
  /** 是否启用，默认取移动端判断结果 */
  enabled?: boolean;
  /** 容器选择器，默认 document.documentElement */
  containerSelector?: string;
  /** 是否禁用默认的 CSS spinner 指示器 */
  disableIndicator?: boolean;
}

interface PullState {
  /** 下拉距离（px） */
  pullDistance: number;
  /** 是否已达到刷新阈值 */
  isReady: boolean;
  /** 是否正在刷新 */
  isRefreshing: boolean;
}

/**
 * 移动端下拉刷新 Hook
 *
 * 检测页面顶部下拉手势，超过阈值后触发 onRefresh 回调。
 * 返回下拉状态，可用于自定义指示器渲染。
 */
export function usePullToRefresh(options: UsePullToRefreshOptions) {
  const {
    onRefresh,
    enabled: enabledOption,
    containerSelector,
    disableIndicator = false,
  } = options;

  const { isMobile } = useIsMobile();
  const enabled = enabledOption ?? isMobile;

  const [pullState, setPullState] = useState<PullState>({
    pullDistance: 0,
    isReady: false,
    isRefreshing: false,
  });

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const isPullingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const containerRef = useRef<HTMLElement | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (!enabled) return;

    const container = containerSelector
      ? document.querySelector<HTMLElement>(containerSelector)
      : document.documentElement;

    if (!container) return;
    containerRef.current = container;

    const getScrollTop = (): number => {
      return container === document.documentElement
        ? window.scrollY || document.documentElement.scrollTop || document.body.scrollTop
        : container.scrollTop;
    };

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current) return;

      const touch = e.touches[0];
      startYRef.current = touch.clientY;
      startXRef.current = touch.clientX;

      if (getScrollTop() <= 0) {
        isPullingRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isPullingRef.current || isRefreshingRef.current) return;

      const touch = e.touches[0];
      const deltaY = touch.clientY - startYRef.current;
      const deltaX = touch.clientX - startXRef.current;

      // 水平滑动距离大于垂直，不处理
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        isPullingRef.current = false;
        setPullState({ pullDistance: 0, isReady: false, isRefreshing: false });
        return;
      }

      // 仅处理向下拉
      if (deltaY <= 0) {
        setPullState({ pullDistance: 0, isReady: false, isRefreshing: false });
        return;
      }

      // 阻尼效果：下拉距离越大阻力越大
      const damped = Math.min(deltaY * 0.5, MAX_PULL_DISTANCE);
      const isReady = damped >= PULL_THRESHOLD;

      pullDistanceRef.current = damped;
      setPullState({ pullDistance: damped, isReady, isRefreshing: false });

      // 阻止页面滚动
      if (getScrollTop() <= 0) {
        e.preventDefault();
      }
    };

    const onTouchEnd = async () => {
      if (!isPullingRef.current || isRefreshingRef.current) return;

      const pullDistance = pullDistanceRef.current;

      if (pullDistance >= PULL_THRESHOLD) {
        isRefreshingRef.current = true;
        setPullState({ pullDistance: PULL_THRESHOLD, isReady: false, isRefreshing: true });

        try {
          await onRefreshRef.current();
        } finally {
          isRefreshingRef.current = false;
          isPullingRef.current = false;
          setPullState({ pullDistance: 0, isReady: false, isRefreshing: false });
        }
      } else {
        isPullingRef.current = false;
        setPullState({ pullDistance: 0, isReady: false, isRefreshing: false });
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, containerSelector]);

  // 当 onRefresh 变化时，通过 ref 同步，避免 effect 重新绑定
  const indicator = disableIndicator ? null : (
    <PullToRefreshIndicator
      pullDistance={pullState.pullDistance}
      isReady={pullState.isReady}
      isRefreshing={pullState.isRefreshing}
    />
  );

  return {
    pullState,
    indicator,
  };
}

/* ─── 下拉刷新指示器组件 ────────────────────────────── */

interface PullToRefreshIndicatorProps {
  pullDistance: number;
  isReady: boolean;
  isRefreshing: boolean;
}

/**
 * 下拉刷新指示器
 *
 * 跟随手指移动显示下拉进度，达到阈值后提示"释放刷新"，
 * 刷新中显示旋转动画。
 */
export const PullToRefreshIndicator: React.FC<PullToRefreshIndicatorProps> = ({
  pullDistance,
  isReady,
  isRefreshing,
}) => {
  if (pullDistance <= 0 && !isRefreshing) return null;

  const height = isRefreshing ? 48 : Math.min(pullDistance, 48);
  const opacity = isRefreshing ? 1 : Math.min(pullDistance / 30, 1);

  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center overflow-hidden transition-[height] duration-200"
      style={{
        height: `${height}px`,
        opacity,
      }}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2">
        {isRefreshing ? (
          <>
            <svg
              className="animate-spin h-5 w-5 text-primary-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <span className="text-sm text-slate-600 dark:text-slate-300">
              刷新中...
            </span>
          </>
        ) : isReady ? (
          <span className="text-sm text-primary-500 font-medium">
            释放刷新
          </span>
        ) : (
          <svg
            className="h-5 w-5 text-slate-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            aria-hidden="true"
            style={{
              transform: `rotate(${pullDistance * 3}deg)`,
              transition: "transform 0.1s",
            }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        )}
      </div>
    </div>
  );
};