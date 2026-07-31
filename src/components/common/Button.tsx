import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/utils/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    bg-primary-600 text-white
    hover:bg-primary-700
    active:bg-primary-800
    disabled:bg-primary-300 disabled:dark:bg-primary-800
    focus-visible:ring-primary-500
  `,
  secondary: `
    bg-gray-100 text-gray-700
    dark:bg-slate-700 dark:text-gray-200
    hover:bg-gray-200 dark:hover:bg-slate-600
    active:bg-gray-300 dark:active:bg-slate-500
    disabled:bg-gray-50 disabled:dark:bg-slate-800 disabled:text-gray-400 disabled:dark:text-gray-500
    focus-visible:ring-gray-300 dark:focus-visible:ring-slate-600
  `,
  ghost: `
    bg-transparent text-gray-700
    dark:text-gray-200
    border border-gray-300 dark:border-slate-500
    hover:bg-gray-50 dark:hover:bg-slate-700
    active:bg-gray-100 dark:active:bg-slate-600
    disabled:text-gray-400 disabled:dark:text-gray-500 disabled:border-gray-200 disabled:dark:border-slate-500
    focus-visible:ring-gray-300 dark:focus-visible:ring-slate-600
  `,
  danger: `
    bg-red-600 text-white
    hover:bg-red-700
    active:bg-red-800
    disabled:bg-red-300 disabled:dark:bg-red-900
    focus-visible:ring-red-500
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm h-8 min-h-[32px]',
  md: 'px-4 py-2 text-sm h-10 min-h-[40px]',
  lg: 'px-6 py-3 text-base h-12 min-h-[48px]',
};

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      disabled,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading}
        className={cn(
          'inline-flex items-center justify-center gap-2',
          'font-medium rounded-lg',
          'transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
          'dark:focus-visible:ring-offset-slate-900',
          'disabled:cursor-not-allowed disabled:opacity-60',
          'min-w-[44px] min-h-[44px]',
          variantStyles[variant],
          sizeStyles[size],
          fullWidth && 'w-full',
          className
        )}
        {...props}
      >
        {loading ? (
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
        ) : (
          leftIcon
        )}
        {children}
        {!loading && rightIcon}
      </button>
    );
  }
);

Button.displayName = 'Button';

export { Button };
export type { ButtonProps, ButtonVariant, ButtonSize };
