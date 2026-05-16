import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/lib/utils';

interface SkeletonCardProps {
  hasImage?: boolean;
  lines?: number;
  className?: string;
}

export const SkeletonCard: React.FC<SkeletonCardProps> = ({
  hasImage = false,
  lines = 3,
  className,
}) => {
  return (
    <div
      className={cn(
        'rounded-lg border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4',
        className
      )}
    >
      {hasImage && (
        <Skeleton variant="rectangular" className="w-full h-40 mb-4" />
      )}
      
      <Skeleton variant="text" className="w-3/4 h-5 mb-3" />
      
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton
            key={index}
            variant="text"
            className={cn(
              'h-4',
              index === lines - 1 ? 'w-1/2' : 'w-full'
            )}
          />
        ))}
      </div>
      
      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
        <Skeleton variant="circular" width={24} height={24} />
        <Skeleton variant="text" className="w-20 h-4" />
      </div>
    </div>
  );
};

export type { SkeletonCardProps };
