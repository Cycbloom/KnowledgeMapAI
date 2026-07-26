import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface RetryButtonProps {
  onClick: () => void;
  label?: string;
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  className?: string;
}

const variantClasses: Record<NonNullable<RetryButtonProps['variant']>, string> = {
  primary:
    'bg-primary-600 hover:bg-primary-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800',
  ghost:
    'text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
  danger:
    'bg-red-600 hover:bg-red-700 text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-800',
};

const sizeClasses: Record<NonNullable<RetryButtonProps['size']>, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

const baseClasses =
  'inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed';

export function RetryButton({
  onClick,
  label,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  className,
}: RetryButtonProps) {
  const { t } = useTranslation();
  const displayLabel = label ?? t('form.error.retry');

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      aria-busy={isLoading}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
    >
      {isLoading && (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      )}
      {displayLabel}
      {isLoading && (
        <span className="sr-only">{t('common.aria.loading')}</span>
      )}
    </button>
  );
}
