import React from 'react';
import { FileX, SearchX, AlertCircle, Database } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './Button';

type IllustrationType = 'empty' | 'search' | 'error' | 'no-data';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  illustration?: IllustrationType;
  className?: string;
}

const illustrationIcons: Record<IllustrationType, React.ReactNode> = {
  empty: <FileX className="w-12 h-12 text-gray-400 dark:text-gray-500" />,
  search: <SearchX className="w-12 h-12 text-gray-400 dark:text-gray-500" />,
  error: <AlertCircle className="w-12 h-12 text-red-400 dark:text-red-500" />,
  'no-data': <Database className="w-12 h-12 text-gray-400 dark:text-gray-500" />,
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  illustration = 'empty',
  className,
}: EmptyStateProps) {
  const displayIcon = icon ?? illustrationIcons[illustration];

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center',
        'min-h-[200px]',
        className
      )}
    >
      <div className="mb-4">{displayIcon}</div>

      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
          {description}
        </p>
      )}

      {action && (
        <Button
          variant="primary"
          size="md"
          onClick={action.onClick}
          className="mt-2"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
