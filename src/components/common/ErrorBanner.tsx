import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, RefreshCcw, Home, X, Bug } from 'lucide-react';
import { cn } from '@/utils/utils';
import { message } from '@/utils/messageHelper';

export type ErrorBannerLevel = 'toast' | 'banner' | 'fullscreen';

export interface ErrorBannerProps {
  /** 错误级别 */
  level: ErrorBannerLevel;
  /** 错误标题 */
  title?: string;
  /** 错误消息 */
  message: string;
  /** 原始 Error 对象 */
  error?: Error;
  /** 重试回调 */
  onRetry?: () => void;
  /** 关闭回调 */
  onDismiss?: () => void;
  /** toast 模式自动消失时间（毫秒），默认 5000 */
  duration?: number;
  /** 额外操作按钮 */
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

function ToastError({
  message: messageText,
  duration = 5000,
  action,
  onDismiss,
}: {
  message: string;
  duration?: number;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}) {
  const messageIdRef = useRef<string | null>(null);
  const dismissedRef = useRef(false);

  useEffect(() => {
    const id = message.error(messageText, {
      duration,
      action: action
        ? { label: action.label, onClick: action.onClick }
        : undefined,
    });
    messageIdRef.current = id;

    return () => {
      if (messageIdRef.current && !dismissedRef.current) {
        message.dismiss(messageIdRef.current);
        messageIdRef.current = null;
      }
    };
  }, [messageText, duration, action]);

  useEffect(() => {
    if (!onDismiss) return;

    const timer = setTimeout(() => {
      if (!dismissedRef.current) {
        dismissedRef.current = true;
        onDismiss();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onDismiss]);

  return null;
}

function BannerError({
  title,
  message: messageText,
  onRetry,
  onDismiss,
  action,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const { t } = useTranslation();
  const displayTitle = title ?? t('common.error');

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-3 shadow-lg',
          'bg-red-50 dark:bg-red-900/90 border-b border-red-200 dark:border-red-800',
          className,
        )}
      >
        <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500 dark:text-red-400" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            {displayTitle}
          </p>
          <p className="text-xs text-red-600 dark:text-red-300 truncate">
            {messageText}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium',
                'text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-800',
                'hover:bg-red-200 dark:hover:bg-red-700 transition-colors',
              )}
            >
              <RefreshCcw className="h-3 w-3" />
              {t('errors.boundary.retry')}
            </button>
          )}
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className={cn(
                'inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium',
                'text-red-700 dark:text-red-200 bg-red-100 dark:bg-red-800',
                'hover:bg-red-200 dark:hover:bg-red-700 transition-colors',
              )}
            >
              {action.label}
            </button>
          )}
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label={t('common.close')}
              className={cn(
                'rounded p-1 text-red-500 dark:text-red-300',
                'hover:bg-red-100 dark:hover:bg-red-800 transition-colors',
              )}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

function FullscreenError({
  title,
  message: messageText,
  error,
  onRetry,
  onDismiss,
  action,
  className,
}: {
  title?: string;
  message: string;
  error?: Error;
  onRetry?: () => void;
  onDismiss?: () => void;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  const { t } = useTranslation();
  const displayTitle = title ?? t('errors.boundary.title');

  const handleReload = () => {
    window.location.reload();
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  return (
    <AnimatePresence>
      <motion.div
        role="alert"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          'flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900 p-4',
          className,
        )}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.2 }}
          className="bg-white dark:bg-slate-800 p-8 rounded-xl shadow-lg max-w-lg w-full text-center border border-gray-100 dark:border-slate-600"
        >
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 mb-6">
            <AlertTriangle
              aria-hidden="true"
              className="h-8 w-8 text-red-600 dark:text-red-400"
            />
          </div>

          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            {displayTitle}
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            {messageText}
          </p>

          {error && (
            <details className="mt-4 mb-6 text-left">
              <summary className="cursor-pointer text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
                {t('errors.boundary.componentStack')}
              </summary>
              <pre className="mt-2 p-3 rounded-lg bg-gray-50 dark:bg-slate-700 text-xs font-mono text-gray-600 dark:text-gray-300 overflow-auto max-h-32 border border-gray-200 dark:border-slate-500">
                {error.stack ?? error.message}
              </pre>
            </details>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className={cn(
                  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md',
                  'text-white bg-primary-600 hover:bg-primary-700',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                  'focus-visible:ring-offset-slate-800 transition-colors',
                )}
              >
                <RefreshCcw className="w-4 h-4 mr-2" />
                {t('errors.boundary.retry')}
              </button>
            )}

            <button
              type="button"
              onClick={handleReload}
              className={cn(
                'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md',
                'text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700',
                'border border-gray-300 dark:border-slate-500 shadow-sm',
                'hover:bg-gray-50 dark:hover:bg-slate-600',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                'focus-visible:ring-offset-slate-800 transition-colors',
              )}
            >
              <Bug className="w-4 h-4 mr-2" />
              {t('errors.boundary.reload')}
            </button>

            <button
              type="button"
              onClick={handleGoHome}
              className={cn(
                'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md',
                'text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700',
                'border border-gray-300 dark:border-slate-500 shadow-sm',
                'hover:bg-gray-50 dark:hover:bg-slate-600',
                'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                'focus-visible:ring-offset-slate-800 transition-colors',
              )}
            >
              <Home className="w-4 h-4 mr-2" />
              {t('errors.boundary.goHome')}
            </button>

            {action && (
              <button
                type="button"
                onClick={action.onClick}
                className={cn(
                  'inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-md',
                  'text-gray-700 dark:text-gray-200 bg-white dark:bg-slate-700',
                  'border border-gray-300 dark:border-slate-500 shadow-sm',
                  'hover:bg-gray-50 dark:hover:bg-slate-600',
                  'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500',
                  'focus-visible:ring-offset-slate-800 transition-colors',
                )}
              >
                {action.label}
              </button>
            )}
          </div>

          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className={cn(
                'mt-4 inline-flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500',
                'hover:text-gray-600 dark:hover:text-gray-300 transition-colors',
              )}
            >
              <X className="h-3 w-3" />
              {t('common.close')}
            </button>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export function ErrorBanner({
  level,
  title,
  message: messageText,
  error,
  onRetry,
  onDismiss,
  duration = 5000,
  action,
  className,
}: ErrorBannerProps) {
  if (level === 'toast') {
    return (
      <ToastError
        message={messageText}
        duration={duration}
        action={action}
        onDismiss={onDismiss}
      />
    );
  }

  if (level === 'banner') {
    return (
      <BannerError
        title={title}
        message={messageText}
        onRetry={onRetry}
        onDismiss={onDismiss}
        action={action}
        className={className}
      />
    );
  }

  return (
    <FullscreenError
      title={title}
      message={messageText}
      error={error}
      onRetry={onRetry}
      onDismiss={onDismiss}
      action={action}
      className={className}
    />
  );
}