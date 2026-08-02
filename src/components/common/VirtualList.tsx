import React, { useRef, useCallback, useEffect, useState, memo } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion } from 'framer-motion';
import { cn } from '@/utils/utils';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';
import { EmptyState } from './EmptyState';
import { Loading } from './Loading';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VirtualListProps<T> {
  /** 列表数据 */
  items: T[];
  /** 自定义行渲染器 */
  renderItem: (item: T, index: number) => React.ReactNode;
  /** 估算行高度（像素），支持可变高度。默认值适合大多数场景 */
  estimateSize?: (index: number) => number;
  /** 可视区域外额外渲染的行数，默认 5 */
  overscan?: number;
  /** 外层容器 className */
  className?: string;
  /** 列表容器样式，用于设置高度等 */
  style?: React.CSSProperties;
  /** 是否正在加载 */
  isLoading?: boolean;
  /** 空状态内容，默认使用 EmptyState 组件 */
  emptyState?: React.ReactNode;
  /** 加载状态内容，默认使用 Loading 组件 */
  loadingState?: React.ReactNode;
  /** 是否启用 framer-motion 入场动画，默认 true */
  animate?: boolean;
  /** 无障碍 role */
  role?: string;
  /** 滚动到底部回调 */
  onEndReached?: () => void;
  /** 触发 onEndReached 的阈值（像素），默认 200 */
  endReachedThreshold?: number;
  /** 自定义 item key 生成函数，默认使用 index */
  getItemKey?: (index: number) => string | number;
  /** 外部滚动容器 ref，不传则使用内部 div */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** 列表项容器额外 className */
  itemClassName?: string;
}

// ─── Defaults ────────────────────────────────────────────────────────────────

const DEFAULT_ESTIMATE_SIZE = 72;
const DEFAULT_OVERSCAN = 5;
const DEFAULT_END_REACHED_THRESHOLD = 200;

// ─── Animated item wrapper ───────────────────────────────────────────────────

interface AnimatedItemProps {
  children: React.ReactNode;
  index: number;
  animate: boolean;
  className?: string;
}

function AnimatedItem({ children, index, animate, className }: AnimatedItemProps) {
  const { transitionOverride } = useReducedMotionOrPreference();

  if (!animate) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={transitionOverride ?? { duration: 0.2, delay: Math.min(index * 0.02, 0.3) }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

function VirtualListComponent<T>({
  items,
  renderItem,
  estimateSize = () => DEFAULT_ESTIMATE_SIZE,
  overscan = DEFAULT_OVERSCAN,
  className,
  style,
  isLoading = false,
  emptyState,
  loadingState,
  animate = true,
  role,
  onEndReached,
  endReachedThreshold = DEFAULT_END_REACHED_THRESHOLD,
  getItemKey,
  scrollContainerRef: externalContainerRef,
  itemClassName,
}: VirtualListProps<T>) {
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const [internalContainer, setInternalContainer] = useState<HTMLDivElement | null>(null);
  const endReachedSentinelRef = useRef(false);

  // Use callback ref to get the DOM element
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    internalContainerRef.current = node;
    setInternalContainer(node);
  }, []);

  const scrollElement = externalContainerRef?.current ?? internalContainer;

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: useCallback(() => scrollElement, [scrollElement]),
    estimateSize,
    overscan,
    getItemKey,
  });

  // ── onEndReached ─────────────────────────────────────────────────────────

  useEffect(() => {
    if (!onEndReached || items.length === 0) return;

    const virtualItems = virtualizer.getVirtualItems();
    if (virtualItems.length === 0) return;

    const totalSize = virtualizer.getTotalSize();
    const scrollOffset = scrollElement?.scrollTop ?? 0;
    const scrollSize = scrollElement?.clientHeight ?? 0;

    const distanceFromBottom = totalSize - scrollOffset - scrollSize;

    if (distanceFromBottom < endReachedThreshold && !endReachedSentinelRef.current) {
      endReachedSentinelRef.current = true;
      onEndReached();
    }

    if (distanceFromBottom >= endReachedThreshold) {
      endReachedSentinelRef.current = false;
    }
  }, [
    virtualizer.getVirtualItems(),
    virtualizer.getTotalSize(),
    scrollElement?.scrollTop,
    scrollElement?.clientHeight,
    onEndReached,
    endReachedThreshold,
    items.length,
  ]);

  // ── Loading state ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center py-12', className)} style={style}>
        {loadingState ?? <Loading size="md" />}
      </div>
    );
  }

  // ── Empty state ──────────────────────────────────────────────────────────

  if (items.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={style}>
        {emptyState ?? <EmptyState title="暂无数据" variant="inline" />}
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={setContainerRef}
      className={cn('overflow-auto', className)}
      style={{
        ...style,
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
      role={role}
    >
      <div
        style={{
          height: virtualizer.getTotalSize(),
          position: 'relative',
          width: '100%',
        }}
      >
        <div
          style={{
            transform: `translateY(${virtualItems[0]?.start ?? 0}px)`,
            willChange: 'transform',
          }}
        >
          {virtualItems.map((virtualItem) => (
            <div
              key={virtualItem.key}
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
              }}
            >
              <AnimatedItem
                index={virtualItem.index}
                animate={animate}
                className={itemClassName}
              >
                {renderItem(items[virtualItem.index], virtualItem.index)}
              </AnimatedItem>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export const VirtualList = memo(VirtualListComponent) as typeof VirtualListComponent;

// ─── VirtualGrid (backward compatibility) ────────────────────────────────────

export interface VirtualGridProps<T> {
  items: T[];
  itemWidth: number;
  itemHeight: number;
  containerWidth: number;
  containerHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
  gap?: number;
  overscan?: number;
  className?: string;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  loadingState?: React.ReactNode;
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
  isLoading = false,
  emptyState,
  loadingState,
}: VirtualGridProps<T>) {
  const gridContainerRef = useRef<HTMLDivElement | null>(null);

  const columns = Math.max(1, Math.floor((containerWidth + gap) / (itemWidth + gap)));
  const rows = Math.ceil(items.length / columns);
  const totalHeight = rows * (itemHeight + gap) - gap;

  const gridVirtualizer = useVirtualizer({
    count: rows,
    getScrollElement: () => gridContainerRef.current,
    estimateSize: () => itemHeight + gap,
    overscan,
  });

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height: containerHeight }}>
        {loadingState ?? <Loading size="md" />}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className={cn('flex items-center justify-center', className)} style={{ height: containerHeight }}>
        {emptyState ?? <EmptyState title="暂无数据" variant="inline" />}
      </div>
    );
  }

  const visibleRows = gridVirtualizer.getVirtualItems();

  return (
    <div
      ref={gridContainerRef}
      className={cn('overflow-auto', className)}
      style={{
        height: containerHeight,
        width: containerWidth,
        overscrollBehavior: 'contain',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {visibleRows.map((virtualRow) => {
          const rowIndex = virtualRow.index;

          const itemsInRow: { item: T; colIndex: number; globalIndex: number }[] = [];
          for (let col = 0; col < columns; col++) {
            const globalIndex = rowIndex * columns + col;
            if (globalIndex < items.length) {
              itemsInRow.push({
                item: items[globalIndex],
                colIndex: col,
                globalIndex,
              });
            }
          }

          return (
            <div
              key={virtualRow.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: `translateY(${virtualRow.start}px)`,
                width: '100%',
                display: 'flex',
                gap,
              }}
            >
              {itemsInRow.map(({ item, globalIndex }) => (
                <div
                  key={globalIndex}
                  style={{
                    width: itemWidth,
                    height: itemHeight,
                    flexShrink: 0,
                  }}
                >
                  {renderItem(item, globalIndex)}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const VirtualGrid = memo(VirtualGridComponent) as typeof VirtualGridComponent;