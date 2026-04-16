import { useState, useEffect, useCallback, useRef } from "react";

type ScrollDirection = "up" | "down" | null;

interface UseScrollDirectionOptions {
  threshold?: number;
  debounceMs?: number;
  scrollableSelector?: string;
}

export function useScrollDirection(
  ref: React.RefObject<HTMLElement | null>,
  options: UseScrollDirectionOptions = {},
): ScrollDirection {
  const { threshold = 5, debounceMs = 50, scrollableSelector } = options;
  const [direction, setDirection] = useState<ScrollDirection>(null);
  const accumulatedDelta = useRef(0);
  const lastUpdateTime = useRef(0);

  const handleWheel = useCallback(
    (event: WheelEvent) => {
      const scrollableEl = scrollableSelector
        ? (event.target as HTMLElement).closest(scrollableSelector)
        : null;

      if (scrollableEl) {
        const { scrollTop } = scrollableEl;

        if (event.deltaY > 0 && scrollTop > 0) return;
        if (event.deltaY < 0 && scrollTop > 0) return;
      }

      const now = Date.now();
      if (now - lastUpdateTime.current > debounceMs) {
        accumulatedDelta.current = 0;
      }
      lastUpdateTime.current = now;

      accumulatedDelta.current += event.deltaY;

      if (Math.abs(accumulatedDelta.current) >= threshold) {
        if (accumulatedDelta.current > 0) {
          setDirection("down");
        } else {
          setDirection("up");
        }
        accumulatedDelta.current = 0;
      }
    },
    [threshold, debounceMs, scrollableSelector],
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    element.addEventListener("wheel", handleWheel, { passive: true });

    return () => {
      element.removeEventListener("wheel", handleWheel);
    };
  }, [ref, handleWheel]);

  return direction;
}
