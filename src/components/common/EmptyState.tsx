import React from 'react';
import { FileX, SearchX, AlertCircle, Database, Compass, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';
import { Button } from './Button';

type IllustrationType = 'empty' | 'search' | 'error' | 'no-data' | 'guide';
type EmptyStateSize = 'sm' | 'md' | 'lg';
type EmptyStateVariant = 'page' | 'panel' | 'inline';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  illustration?: IllustrationType;
  className?: string;
  size?: EmptyStateSize;
  iconWrapper?: boolean;
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: EmptyStateVariant;
  dismissible?: boolean;
  onDismiss?: () => void;
  acknowledge?: {
    label: string;
    onClick: () => void;
  };
}

const illustrationConfig: Record<
  IllustrationType,
  { Component: React.ElementType; colorClass: string }
> = {
  empty: { Component: FileX, colorClass: 'text-gray-400 dark:text-gray-500' },
  search: { Component: SearchX, colorClass: 'text-gray-400 dark:text-gray-500' },
  error: { Component: AlertCircle, colorClass: 'text-red-400 dark:text-red-500' },
  'no-data': { Component: Database, colorClass: 'text-gray-400 dark:text-gray-500' },
  guide: { Component: Compass, colorClass: 'text-primary-500 dark:text-primary-400' },
};

const sizeIconClasses: Record<EmptyStateSize, string> = {
  sm: 'w-8 h-8',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

const sizeWrapperPadding: Record<EmptyStateSize, string> = {
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

const variantContainerClasses: Record<EmptyStateVariant, string> = {
  page: 'min-h-[200px] py-12',
  panel: 'min-h-[120px] py-8',
  inline: 'min-h-[80px] py-4',
};

const EmptyStateComponent: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  illustration = 'empty',
  className,
  size = 'md',
  iconWrapper = false,
  secondaryAction,
  variant = 'page',
  dismissible = false,
  onDismiss,
  acknowledge,
}) => {
  const { t } = useTranslation();
  const { Component, colorClass } = illustrationConfig[illustration];
  const displayIcon = icon ?? (
    <Component className={cn(sizeIconClasses[size], colorClass)} />
  );

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col items-center justify-center px-4 text-center',
        dismissible && 'relative',
        variantContainerClasses[variant],
        className
      )}
    >
      {dismissible && (
        <button
          type="button"
          aria-label={t('common.aria.dismiss')}
          onClick={onDismiss}
          className="absolute top-3 right-3 p-1 rounded-md text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="mb-4">
        {iconWrapper ? (
          <div
            data-testid="empty-state-icon-wrapper"
            className={cn(
              'inline-flex items-center justify-center rounded-full bg-gray-100 dark:bg-slate-800',
              sizeWrapperPadding[size]
            )}
          >
            {displayIcon}
          </div>
        ) : (
          displayIcon
        )}
      </div>

      <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
        {title}
      </h3>

      {description && (
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mb-4">
          {description}
        </p>
      )}

      {(action || secondaryAction || acknowledge) && (
        <div
          data-testid="empty-state-actions"
          className="flex items-center justify-center gap-3 flex-wrap mt-2"
        >
          {action && (
            <Button variant="primary" size="md" onClick={action.onClick}>
              {action.label}
            </Button>
          )}
          {acknowledge && (
            <Button variant="primary" size="md" onClick={acknowledge.onClick}>
              {acknowledge.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="ghost" size="md" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export const EmptyState = React.memo(EmptyStateComponent);
