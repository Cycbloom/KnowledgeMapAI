import React from 'react';
import { cn } from '@/utils/utils';

interface DetailStatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  valueClassName?: string;
  className?: string;
}

function DetailStatCardComponent({
  label,
  value,
  icon,
  valueClassName,
  className,
}: DetailStatCardProps) {
  return (
    <div className={cn('p-4 rounded-xl border', className)}>
      <div className="flex items-center gap-2 mb-1">
        {icon}
        <span className="text-sm text-gray-400 dark:text-gray-500">{label}</span>
      </div>
      <div className={cn('text-lg font-semibold', valueClassName)}>{value}</div>
    </div>
  );
}

export const DetailStatCard = React.memo(DetailStatCardComponent);

export type { DetailStatCardProps };