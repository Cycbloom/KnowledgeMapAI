import React from 'react';
import { Skeleton } from './Skeleton';
import { cn } from '@/utils/utils';

interface SkeletonListProps {
  items?: number;
  hasAvatar?: boolean;
  className?: string;
}

export const SkeletonList: React.FC<SkeletonListProps> = ({
  items = 6,
  hasAvatar = false,
  className,
}) => {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: items }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 p-3">
          {hasAvatar && (
            <Skeleton variant="circular" width={40} height={40} />
          )}
          <div className="flex-1 space-y-2">
            <Skeleton variant="text" className="h-5 w-3/4" />
            <Skeleton variant="text" className="h-4 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
};

export type { SkeletonListProps };
