import React from 'react';
import { cn } from '@/utils/utils';

interface DetailCardProps {
  title?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

function DetailCardComponent({
  title,
  icon,
  action,
  className,
  bodyClassName,
  children,
}: DetailCardProps) {
  const hasTitleBar = title !== undefined || icon !== undefined || action !== undefined;

  return (
    <div className={cn('p-4 rounded-xl border', className)}>
      {hasTitleBar && (
        <div className="flex items-center gap-2 mb-2">
          <span className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
            {icon}
            {title}
          </span>
          {action !== undefined && <div className="ml-auto">{action}</div>}
        </div>
      )}
      <div className={cn(bodyClassName)}>{children}</div>
    </div>
  );
}

export const DetailCard = React.memo(DetailCardComponent);

export type { DetailCardProps };