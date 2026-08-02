import React from 'react';
import { motion } from 'framer-motion';
import { Skeleton } from './Skeleton';
import { SkeletonCard } from './SkeletonCard';
import { cn } from '@/utils/utils';

type LazyLoadFallbackVariant = 'text' | 'card';

interface LazyLoadFallbackProps {
  /** Visual variant: 'text' for skeleton lines (route-level), 'card' for card grid (page-level) */
  variant?: LazyLoadFallbackVariant;
  /** Number of skeleton rows (text variant) or card columns (card variant) */
  count?: number;
  /** Additional class names for the container */
  className?: string;
  /** Custom height for the container */
  height?: string | number;
}

export const LazyLoadFallback: React.FC<LazyLoadFallbackProps> = ({
  variant = 'text',
  count = 4,
  className,
  height,
}) => {
  if (variant === 'card') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4',
          className,
        )}
        style={height ? { height: typeof height === 'number' ? `${height}px` : height } : undefined}
      >
        {Array.from({ length: count }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900',
        className,
      )}
      style={height ? { height: typeof height === 'number' ? `${height}px` : height } : undefined}
    >
      <div className="w-full max-w-md p-6 space-y-4" aria-hidden="true">
        {Array.from({ length: count }).map((_, index) => {
          // First row acts as a title placeholder (taller)
          if (index === 0) {
            return <Skeleton key={index} variant="text" className="h-8 w-48" />;
          }
          // Last row is shorter width
          if (index === count - 1) {
            return <Skeleton key={index} variant="text" className="h-4 w-2/3" />;
          }
          // Middle rows alternate width for organic look
          return (
            <Skeleton
              key={index}
              variant="text"
              className={cn('h-4', index % 2 === 0 ? 'w-full' : 'w-5/6')}
            />
          );
        })}
      </div>
      <span className="sr-only">Loading...</span>
    </motion.div>
  );
};

export type { LazyLoadFallbackProps, LazyLoadFallbackVariant };