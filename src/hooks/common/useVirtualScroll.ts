import { useState, useCallback, useMemo, useEffect, useRef } from 'react';

// ─── Options ─────────────────────────────────────────────────────────────────

export interface UseVirtualScrollListOptions<T> {
  items: T[];
  containerHeight: number;
  itemHeight: number;
  overscan?: number;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

export interface UseVirtualScrollGridOptions<T> extends UseVirtualScrollListOptions<T> {
  itemWidth: number;
  containerWidth: number;
  gap?: number;
}

// ─── Return types ────────────────────────────────────────────────────────────

export interface UseVirtualScrollListReturn<T> {
  visibleItems: T[];
  startIndex: number;
  endIndex: number;
  totalHeight: number;
  offsetY: number;
  handleScroll: (e: React.UIEvent<HTMLElement>) => void;
}

export interface UseVirtualScrollGridReturn<T> {
  visibleItems: { item: T; index: number; x: number; y: number }[];
  totalHeight: number;
  handleScroll: (e: React.UIEvent<HTMLElement>) => void;
}

// ─── Overloads ───────────────────────────────────────────────────────────────

export function useVirtualScroll<T>(
  options: UseVirtualScrollGridOptions<T>,
): UseVirtualScrollGridReturn<T>;
export function useVirtualScroll<T>(
  options: UseVirtualScrollListOptions<T>,
): UseVirtualScrollListReturn<T>;

// ─── Implementation ──────────────────────────────────────────────────────────

export function useVirtualScroll<T>(
  options: UseVirtualScrollListOptions<T> | UseVirtualScrollGridOptions<T>,
): UseVirtualScrollListReturn<T> | UseVirtualScrollGridReturn<T> {
  const {
    items,
    containerHeight,
    itemHeight,
    overscan = 3,
    onEndReached,
    endReachedThreshold = 5,
  } = options;

  const isGridMode = 'itemWidth' in options && 'containerWidth' in options;
  const itemWidth = isGridMode
    ? (options as UseVirtualScrollGridOptions<T>).itemWidth
    : 0;
  const containerWidth = isGridMode
    ? (options as UseVirtualScrollGridOptions<T>).containerWidth
    : 0;
  const gap = isGridMode
    ? (options as UseVirtualScrollGridOptions<T>).gap ?? 0
    : 0;

  // ── Scroll state ─────────────────────────────────────────────────────────

  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  // ── rAF throttle ─────────────────────────────────────────────────────────

  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  // ── onEndReached dedup ───────────────────────────────────────────────────

  const lastScrollTopRef = useRef(0);

  // ── handleScroll ─────────────────────────────────────────────────────────

  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLElement>) => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }

      const target = e.currentTarget;

      rafRef.current = requestAnimationFrame(() => {
        const newScrollTop = target.scrollTop;
        setScrollTop(newScrollTop);

        if (isGridMode) {
          setScrollLeft(target.scrollLeft);
        }

        // onEndReached check
        if (onEndReached) {
          const distanceFromBottom =
            target.scrollHeight - newScrollTop - target.clientHeight;
          const threshold = endReachedThreshold * itemHeight;
          if (
            distanceFromBottom < threshold &&
            newScrollTop !== lastScrollTopRef.current
          ) {
            lastScrollTopRef.current = newScrollTop;
            onEndReached();
          }
        }

        rafRef.current = null;
      });
    },
    [onEndReached, endReachedThreshold, itemHeight, isGridMode],
  );

  // ── Grid mode computation ────────────────────────────────────────────────

  const gridResult = useMemo(() => {
    if (!isGridMode) return null;

    const columns = Math.max(
      1,
      Math.floor((containerWidth + gap) / (itemWidth + gap)),
    );
    const rows = Math.ceil(items.length / columns);
    const totalHeight = rows * (itemHeight + gap) - gap;

    const visibleRowCount = Math.ceil(containerHeight / (itemHeight + gap));
    const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
    const endRow = Math.min(rows, startRow + visibleRowCount + overscan * 2);

    const visibleColCount = Math.ceil(containerWidth / (itemWidth + gap));
    const startCol = Math.max(0, Math.floor(scrollLeft / (itemWidth + gap)) - overscan);
    const endCol = Math.min(columns, startCol + visibleColCount + overscan * 2);

    const visibleItems: { item: T; index: number; x: number; y: number }[] = [];
    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const index = row * columns + col;
        if (index < items.length) {
          visibleItems.push({
            item: items[index],
            index,
            x: col * (itemWidth + gap),
            y: row * (itemHeight + gap),
          });
        }
      }
    }

    return { visibleItems, totalHeight };
  }, [isGridMode, containerWidth, gap, itemWidth, items, itemHeight, scrollTop, scrollLeft, overscan]);

  // ── List mode computation ────────────────────────────────────────────────

  const listResult = useMemo(() => {
    if (isGridMode) return null;

    const totalHeight = items.length * itemHeight;
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

    const visibleItems = items.slice(startIndex, endIndex);
    const offsetY = startIndex * itemHeight;

    return { visibleItems, startIndex, endIndex, totalHeight, offsetY };
  }, [isGridMode, items, itemHeight, containerHeight, scrollTop, overscan]);

  // ── Return ───────────────────────────────────────────────────────────────

  if (isGridMode && gridResult) {
    return {
      visibleItems: gridResult.visibleItems,
      totalHeight: gridResult.totalHeight,
      handleScroll,
    };
  }

  if (listResult) {
    return {
      visibleItems: listResult.visibleItems,
      startIndex: listResult.startIndex,
      endIndex: listResult.endIndex,
      totalHeight: listResult.totalHeight,
      offsetY: listResult.offsetY,
      handleScroll,
    };
  }

  // Fallback (should never reach)
  return {
    visibleItems: [] as T[],
    startIndex: 0,
    endIndex: 0,
    totalHeight: 0,
    offsetY: 0,
    handleScroll,
  };
}
