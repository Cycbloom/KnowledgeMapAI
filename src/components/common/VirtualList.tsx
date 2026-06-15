import React, { memo } from 'react';
import { useVirtualScroll } from '../../hooks/common/useVirtualScroll';

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
  const { visibleItems, startIndex, totalHeight, offsetY, handleScroll } =
    useVirtualScroll({
      items,
      containerHeight,
      itemHeight,
      overscan,
      onEndReached,
      endReachedThreshold,
    });

  return (
    <div
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
  const { visibleItems, totalHeight, handleScroll } = useVirtualScroll<T>({
    items,
    itemWidth,
    itemHeight,
    containerWidth,
    containerHeight,
    gap,
    overscan,
  });

  return (
    <div
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
