import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

type LoadingSize = 'sm' | 'md' | 'lg';

interface LoadingProps {
  size?: LoadingSize;
  text?: string;
  fullScreen?: boolean;
}

const sizeConfig: Record<LoadingSize, { icon: string; text: string; gap: string }> = {
  sm: {
    icon: 'w-4 h-4',
    text: 'text-xs',
    gap: 'gap-1.5',
  },
  md: {
    icon: 'w-6 h-6',
    text: 'text-sm',
    gap: 'gap-2',
  },
  lg: {
    icon: 'w-8 h-8',
    text: 'text-base',
    gap: 'gap-2.5',
  },
};

export const Loading: React.FC<LoadingProps> = ({
  size = 'md',
  text,
  fullScreen = false,
}) => {
  const config = sizeConfig[size];

  const content = (
    <div className={cn('flex items-center justify-center', config.gap)}>
      <Loader2 className={cn(config.icon, 'animate-spin text-primary-600 dark:text-primary-400')} />
      {text && (
        <span className={cn(config.text, 'text-gray-600 dark:text-gray-300')}>
          {text}
        </span>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
        {content}
      </div>
    );
  }

  return content;
};

export type { LoadingProps, LoadingSize };
