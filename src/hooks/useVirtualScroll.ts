import { useState, useCallback } from 'react';

export const useVirtualScroll = <T,>(
  items: T[],
  containerHeight: number,
  itemHeight: number,
  overscan: number = 3
) => {
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  return {
    visibleItems,
    startIndex,
    endIndex,
    totalHeight,
    offsetY,
    handleScroll,
  };
};
