import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, AlertTriangle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

type ErrorStateIcon = 'alert' | 'error' | 'warning';
type ErrorStateVariant = 'page' | 'panel' | 'inline';
type ErrorStateSize = 'sm' | 'md' | 'lg';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  icon?: ErrorStateIcon;
  variant?: ErrorStateVariant;
  size?: ErrorStateSize;
  className?: string;
}

const iconConfig: Record<ErrorStateIcon, React.ElementType> = {
  alert: AlertCircle,
  error: XCircle,
  warning: AlertTriangle,
};

const sizeIconClasses: Record<ErrorStateSize, string> = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const sizeTitleClasses: Record<ErrorStateSize, string> = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const sizeMessageClasses: Record<ErrorStateSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

const variantContainerClasses: Record<ErrorStateVariant, string> = {
  page: 'flex flex-col items-center justify-center text-center py-12 px-4 gap-4',
  panel: 'flex flex-col items-center justify-center text-center py-8 px-4 gap-3',
  inline: 'flex flex-row items-center gap-2',
};

export function ErrorState({
  title,
  message,
  onRetry,
  retryLabel,
  icon = 'alert',
  variant = 'page',
  size = 'md',
  className,
}: ErrorStateProps) {
  const { t } = useTranslation();
  const Icon = iconConfig[icon];
  const displayTitle = title ?? t('form.error.title');
  const displayRetryLabel = retryLabel ?? t('form.error.retry');
  const isInline = variant === 'inline';

  return (
    <div
      role="alert"
      className={cn(variantContainerClasses[variant], className)}
    >
      <Icon
        className={cn(
          sizeIconClasses[size],
          'text-red-500 dark:text-red-400 flex-shrink-0'
        )}
      />

      {!isInline && (
        <h3
          className={cn(
            sizeTitleClasses[size],
            'font-medium text-red-600 dark:text-red-400'
          )}
        >
          {displayTitle}
        </h3>
      )}

      {message && (
        <p
          className={cn(
            sizeMessageClasses[size],
            'text-gray-600 dark:text-gray-400'
          )}
        >
          {message}
        </p>
      )}

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2',
            'text-sm font-medium text-white hover:bg-primary-700',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
            'focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800'
          )}
        >
          {displayRetryLabel}
        </button>
      )}
    </div>
  );
}
