import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, AlertTriangle, RefreshCw, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/utils';
import { frontendEventBus } from '@/services/timer/FrontendEventBus';
import { useReducedMotionOrPreference } from '@/hooks/common/useReducedMotionOrPreference';
import { useTheme } from '@/hooks';
import type { SyncProgressPayload } from '@/services/FrontendEventTypes';

interface SyncCounts {
  success: number;
  error: number;
  conflict: number;
}

export const OfflineSyncProgress: React.FC = () => {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();
  const [visible, setVisible] = useState(false);
  const [progress, setProgress] = useState<SyncProgressPayload | null>(null);
  const [counts, setCounts] = useState<SyncCounts>({ success: 0, error: 0, conflict: 0 });
  const [isCompleting, setIsCompleting] = useState(false);
  const autoDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 清除自动消失定时器
  const clearAutoDismiss = useCallback(() => {
    if (autoDismissTimerRef.current !== null) {
      clearTimeout(autoDismissTimerRef.current);
      autoDismissTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    const unsubscribe = frontendEventBus.subscribe('sync_progress', (payload: SyncProgressPayload) => {
      setProgress(payload);
      setVisible(true);
      setIsCompleting(false);

      if (payload.status === 'success') {
        setCounts((prev) => ({ ...prev, success: prev.success + 1 }));
      } else if (payload.status === 'error') {
        setCounts((prev) => ({ ...prev, error: prev.error + 1 }));
      } else if (payload.status === 'conflict') {
        setCounts((prev) => ({ ...prev, conflict: prev.conflict + 1 }));
      }

      // 当所有项处理完毕，启动自动消失
      if (payload.current >= payload.total) {
        setIsCompleting(true);
        clearAutoDismiss();
        autoDismissTimerRef.current = setTimeout(() => {
          setVisible(false);
          setCounts({ success: 0, error: 0, conflict: 0 });
          setProgress(null);
          setIsCompleting(false);
        }, 3000);
      }
    });

    return () => {
      unsubscribe();
      clearAutoDismiss();
    };
  }, [clearAutoDismiss]);

  const handleClose = useCallback(() => {
    setVisible(false);
    clearAutoDismiss();
    setCounts({ success: 0, error: 0, conflict: 0 });
    setProgress(null);
    setIsCompleting(false);
  }, [clearAutoDismiss]);

  const progressPercent = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <AnimatePresence>
      {visible && progress && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 20, scale: 0.95 }}
          transition={transitionOverride ?? { duration: 0.2 }}
          className={cn(
            'fixed bottom-4 right-4 z-modal-overlay w-80 rounded-lg shadow-xl border backdrop-blur-sm',
            isDark
              ? 'bg-slate-800/95 border-slate-700 text-slate-200'
              : 'bg-white/95 border-slate-200 text-slate-800',
          )}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <div className="p-3">
            {/* 标题行 */}
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {isCompleting ? (
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                ) : (
                  <RefreshCw className="w-4 h-4 text-primary-500 animate-spin" />
                )}
                <span className="text-sm font-medium">
                  {isCompleting
                    ? t('common.offlineStatus.syncComplete')
                    : t('common.offlineStatus.syncing')}
                </span>
              </div>
              <button
                type="button"
                onClick={handleClose}
                className={cn(
                  'p-1 rounded transition-colors',
                  isDark ? 'hover:bg-slate-700' : 'hover:bg-slate-100',
                )}
                aria-label="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* 进度条 */}
            <div className="mb-2">
              <div className={cn(
                'h-2 rounded-full overflow-hidden',
                isDark ? 'bg-slate-700' : 'bg-slate-200',
              )}>
                <motion.div
                  className={cn(
                    'h-full rounded-full',
                    isCompleting ? 'bg-emerald-500' : 'bg-primary-500',
                  )}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={transitionOverride ?? { duration: 0.3 }}
                />
              </div>
            </div>

            {/* 进度信息 */}
            <div className="flex items-center justify-between text-xs">
              <span className={cn(isDark ? 'text-slate-400' : 'text-slate-500')}>
                {progress.current}/{progress.total}
              </span>
              <span className={cn(isDark ? 'text-slate-400' : 'text-slate-500')}>
                {progressPercent}%
              </span>
            </div>

            {/* 当前项目 */}
            {!isCompleting && progress.status === 'pending' && (
              <div className="mt-1.5 text-xs truncate" title={progress.itemId}>
                <span className={cn(isDark ? 'text-slate-400' : 'text-slate-500')}>
                  {progress.itemId}
                </span>
              </div>
            )}

            {/* 统计计数 */}
            {(counts.success > 0 || counts.error > 0 || counts.conflict > 0) && (
              <div className="mt-2 flex items-center gap-3 text-xs">
                {counts.success > 0 && (
                  <span className="flex items-center gap-1 text-emerald-500">
                    <CheckCircle className="w-3 h-3" />
                    {counts.success}
                  </span>
                )}
                {counts.error > 0 && (
                  <span className="flex items-center gap-1 text-red-500">
                    <AlertCircle className="w-3 h-3" />
                    {counts.error}
                  </span>
                )}
                {counts.conflict > 0 && (
                  <span className="flex items-center gap-1 text-yellow-500">
                    <AlertTriangle className="w-3 h-3" />
                    {counts.conflict}
                  </span>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineSyncProgress;