import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../common/useIsMobile";

const SWIPE_THRESHOLD = 80;
const EDGE_THRESHOLD = 30;

interface UseSwipeBackOptions {
  /** 是否启用滑动返回，默认取移动端判断结果 */
  enabled?: boolean;
  /** 是否在滑动时跟随手指移动（提供视觉反馈），默认 true */
  followFinger?: boolean;
  /** 滑动目标元素的 CSS 选择器，默认整个页面 */
  containerSelector?: string;
  /** 滑动返回回调，默认调用 navigate(-1) */
  onSwipeBack?: () => void;
}

/**
 * 移动端滑动返回 Hook
 *
 * 检测从屏幕左边缘开始的右滑手势，超过阈值后触发返回导航。
 * 可选：跟随手指移动（transform）提供视觉反馈。
 */
export function useSwipeBack(options: UseSwipeBackOptions = {}) {
  const {
    enabled: enabledOption,
    followFinger = true,
    containerSelector,
    onSwipeBack,
  } = options;

  const { isMobile } = useIsMobile();
  const enabled = enabledOption ?? isMobile;
  const navigate = useNavigate();

  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const currentXRef = useRef(0);
  const isSwipingRef = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);
  const onSwipeBackRef = useRef(onSwipeBack);
  const navigateRef = useRef(navigate);

  useEffect(() => {
    onSwipeBackRef.current = onSwipeBack;
    navigateRef.current = navigate;
  }, [onSwipeBack, navigate]);

  useEffect(() => {
    if (!enabled) return;

    const container = containerSelector
      ? document.querySelector<HTMLElement>(containerSelector)
      : document.documentElement;

    if (!container) return;
    containerRef.current = container;

    const setTranslateX = (el: HTMLElement, x: number) => {
      if (!followFinger) return;
      el.style.transform = `translateX(${Math.max(0, x)}px)`;
      el.style.transition = "none";
    };

    const resetTranslateX = (el: HTMLElement) => {
      if (!followFinger) return;
      el.style.transform = "";
      el.style.transition = "";
    };

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startXRef.current = touch.clientX;
      startYRef.current = touch.clientY;
      currentXRef.current = touch.clientX;

      // 仅从屏幕左边缘开始的滑动才触发
      if (touch.clientX <= EDGE_THRESHOLD) {
        isSwipingRef.current = true;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!isSwipingRef.current) return;

      const touch = e.touches[0];
      currentXRef.current = touch.clientX;
      const deltaX = touch.clientX - startXRef.current;
      const deltaY = touch.clientY - startYRef.current;

      // 如果垂直滑动距离大于水平距离，取消滑动返回
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        isSwipingRef.current = false;
        if (followFinger) {
          resetTranslateX(container);
        }
        return;
      }

      if (deltaX <= 0) {
        // 手指向左移动，不处理
        if (followFinger) {
          resetTranslateX(container);
        }
        return;
      }

      // 阻止页面滚动
      e.preventDefault();

      if (followFinger) {
        setTranslateX(container, deltaX * 0.4); // 阻尼跟随
      }
    };

    const onTouchEnd = (_e: TouchEvent) => {
      if (!isSwipingRef.current) return;

      const deltaX = currentXRef.current - startXRef.current;

      if (deltaX >= SWIPE_THRESHOLD) {
        const cb = onSwipeBackRef.current;
        if (cb) {
          cb();
        } else {
          navigateRef.current(-1);
        }
      }

      isSwipingRef.current = false;

      if (followFinger) {
        resetTranslateX(container);
      }
    };

    container.addEventListener("touchstart", onTouchStart, { passive: true });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      if (followFinger) {
        resetTranslateX(container);
      }
    };
  }, [enabled, followFinger, containerSelector]);
}