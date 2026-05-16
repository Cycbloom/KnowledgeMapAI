import React, { useRef, useState, useEffect, useCallback, memo, useMemo } from 'react';

interface VirtualListProps<T> {
  items: T[];
  itemHeight: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  overscan?: number;
  className?: string;
  onEndReached?: () => void;
  endReachedThreshold?: number;
}

function VirtualListComponent<T>({
  items,
  itemHeight,
  containerHeight,
  renderItem,
  overscan = 3,
  className = '',
  onEndReached,
  endReachedThreshold = 5,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastScrollTopRef = useRef(0);

  const totalHeight = items.length * itemHeight;
  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(items.length, startIndex + visibleCount + overscan * 2);

  const visibleItems = useMemo(() => items.slice(startIndex, endIndex), [items, startIndex, endIndex]);
  const offsetY = startIndex * itemHeight;

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(newScrollTop);

      if (onEndReached) {
        const scrollBottom = newScrollTop + containerHeight;
        const threshold = endReachedThreshold * itemHeight;

        if (totalHeight - scrollBottom < threshold) {
          const lastScrollBottom = lastScrollTopRef.current + containerHeight;
          if (totalHeight - lastScrollBottom >= threshold) {
            onEndReached();
          }
        }
      }
      lastScrollTopRef.current = newScrollTop;
    });
  }, [onEndReached, containerHeight, itemHeight, totalHeight, endReachedThreshold]);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{
        height: containerHeight,
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${offsetY}px)`,
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        >
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              {renderItem(item, startIndex + index)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const VirtualList = memo(VirtualListComponent) as typeof VirtualListComponent;

interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
  overscan?: number;
  className?: string;
}

function VirtualGridComponent<T>({
  items,
  itemWidth,
  itemHeight,
  containerWidth,
  containerHeight,
  renderItem,
  gap = 0,
  overscan = 1,
  className = '',
}: VirtualGridProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const rafRef = useRef<number | null>(null);

  const columns = Math.floor((containerWidth + gap) / (itemWidth + gap));
  const rows = Math.ceil(items.length / columns);
  const totalHeight = rows * (itemHeight + gap);

  const startRow = Math.max(0, Math.floor(scrollTop / (itemHeight + gap)) - overscan);
  const endRow = Math.min(rows, startRow + Math.ceil(containerHeight / (itemHeight + gap)) + overscan * 2);

  const startCol = Math.max(0, Math.floor(scrollLeft / (itemWidth + gap)) - overscan);
  const endCol = Math.min(columns, startCol + Math.ceil(containerWidth / (itemWidth + gap)) + overscan * 2);

  const visibleItems = useMemo(() => {
    const result: { item: T; index: number; x: number; y: number }[] = [];

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const index = row * columns + col;
        if (index < items.length) {
          result.push({
            item: items[index],
            index,
            x: col * (itemWidth + gap),
            y: row * (itemHeight + gap),
          });
        }
      }
    }
    return result;
  }, [items, startRow, endRow, startCol, endCol, columns, gap, itemWidth, itemHeight]);

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    const newScrollLeft = e.currentTarget.scrollLeft;

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      setScrollTop(newScrollTop);
      setScrollLeft(newScrollLeft);
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      style={{
        height: containerHeight,
        width: containerWidth,
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleItems.map(({ item, index, x, y }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: itemWidth,
              height: itemHeight,
              willChange: 'transform',
              backfaceVisibility: 'hidden',
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
      </div>
    </div>
  );
}

export const VirtualGrid = memo(VirtualGridComponent) as typeof VirtualGridComponent;
