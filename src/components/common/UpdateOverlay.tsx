import React from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import { Download, X, Loader2, CheckCircle, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { cn } from '@/utils/utils';
import { useUpdateChecker } from '@/hooks/common/useUpdateChecker';
import { useTheme } from '@/hooks';

export const UpdateOverlay: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const {
    status,
    info,
    progress,
    error,
    confirmDownload,
    confirmInstall,
    dismiss,
  } = useUpdateChecker();

  if (status === 'idle') return null;

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 flex items-center gap-3 px-4 py-2.5 shadow-lg border-b backdrop-blur-sm',
          isDark
            ? 'bg-slate-900/95 border-slate-700 text-slate-100'
            : 'bg-white/95 border-gray-200 text-gray-900',
          status === 'error' && (isDark ? 'border-red-800' : 'border-red-200'),
          status === 'downloaded' && (isDark ? 'border-emerald-800' : 'border-emerald-200'),
        )}
        role="status"
        aria-live="polite"
      >
        {/* Icon */}
        <div className="flex-shrink-0">
          {status === 'checking' && (
            <Loader2 className="w-4 h-4 animate-spin text-primary-500" />
          )}
          {status === 'available' && (
            <ArrowUpCircle className="w-4 h-4 text-primary-500" />
          )}
          {status === 'not-available' && (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          {status === 'downloading' && (
            <Download className="w-4 h-4 text-primary-500" />
          )}
          {status === 'downloaded' && (
            <CheckCircle className="w-4 h-4 text-emerald-500" />
          )}
          {status === 'error' && (
            <AlertCircle className="w-4 h-4 text-red-500" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {status === 'checking' && (
            <p className="text-sm font-medium">{t('update.checking', 'Checking for updates...')}</p>
          )}

          {status === 'available' && (
            <p className="text-sm font-medium">
              {t('update.available', 'Update {{version}} available', { version: info?.version ?? '' })}
            </p>
          )}

          {status === 'not-available' && (
            <p className="text-sm font-medium">{t('update.upToDate', "You're up to date!")}</p>
          )}

          {status === 'downloading' && progress && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{t('update.downloading', 'Downloading...')}</span>
                <span className="text-xs opacity-75">{Math.round(progress.percent)}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${progress.percent}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
              <p className="text-xs opacity-60">
                {formatBytes(progress.transferred)} / {formatBytes(progress.total)}
              </p>
            </div>
          )}

          {status === 'downloaded' && (
            <p className="text-sm font-medium">{t('update.readyToInstall', 'Update ready to install')}</p>
          )}

          {status === 'error' && (
            <p className="text-sm font-medium text-red-500">
              {t('update.failed', 'Update failed: {{error}}', { error: error ?? '' })}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'available' && (
            <button
              type="button"
              onClick={confirmDownload}
              className={cn(
                'inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition-colors',
                'bg-primary-600 text-white hover:bg-primary-700',
                'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                isDark && 'focus:ring-offset-slate-900',
              )}
            >
              <Download className="w-3 h-3" />
              {t('common.download', 'Download')}
            </button>
          )}

          {status === 'downloaded' && (
            <>
              <button
                type="button"
                onClick={confirmInstall}
                className={cn(
                  'inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-medium transition-colors',
                  'bg-emerald-600 text-white hover:bg-emerald-700',
                  'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1',
                  isDark && 'focus:ring-offset-slate-900',
                )}
              >
                {t('update.install', 'Install')}
              </button>
              <button
                type="button"
                onClick={dismiss}
                className={cn(
                  'inline-flex items-center rounded px-2.5 py-1.5 text-xs font-medium transition-colors',
                  isDark
                    ? 'text-slate-300 hover:bg-slate-800'
                    : 'text-gray-600 hover:bg-gray-100',
                  'focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-1',
                  isDark && 'focus:ring-offset-slate-900',
                )}
              >
                {t('common.later', 'Later')}
              </button>
            </>
          )}

          {status !== 'checking' && status !== 'downloading' && status !== 'downloaded' && (
            <button
              type="button"
              onClick={dismiss}
              aria-label={t('common.close')}
              className={cn(
                'rounded p-1 transition-colors',
                isDark
                  ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100',
              )}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};