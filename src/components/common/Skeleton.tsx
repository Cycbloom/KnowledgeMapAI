import React from 'react';
import { cn } from '@/utils/utils';

type SkeletonVariant = 'text' | 'circular' | 'rectangular';

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const variantStyles: Record<SkeletonVariant, string> = {
  text: 'rounded',
  circular: 'rounded-full',
  rectangular: 'rounded-lg',
};

const SkeletonComponent: React.FC<SkeletonProps> = ({
  variant = 'text',
  width,
  height,
  className,
}) => {
  const style: React.CSSProperties = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
  };

  if (variant === 'text' && !height) {
    style.height = '1em';
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'animate-pulse bg-gray-200 dark:bg-slate-700',
        variantStyles[variant],
        className
      )}
      style={style}
    />
  );
};

export const Skeleton = React.memo(SkeletonComponent);

export type { SkeletonProps, SkeletonVariant };