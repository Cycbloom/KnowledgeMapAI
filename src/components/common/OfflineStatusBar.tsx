import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '../../hooks/common/useNetworkStatus';
import { useTheme } from '../../hooks';
import { offlineMutationQueue } from '../../utils/offlineMutations';
import { useReducedMotionOrPreference } from '../../hooks/common/useReducedMotionOrPreference';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export const OfflineStatusBar: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [showSuccess, setShowSuccess] = useState(false);
  const { reduceMotion, transitionOverride } = useReducedMotionOrPreference();

  const updatePendingCount = useCallback(async () => {
    const pending = await offlineMutationQueue.getPending();
    setPendingCount(pending.length);
  }, []);

  useEffect(() => {
    updatePendingCount();

    // 订阅 offlineMutationQueue 变化，实时更新 pendingCount
    // 替代旧的 frontendEventBus sync_queue_updated / sync_started / sync_completed 事件
    const unsubscribe = offlineMutationQueue.subscribe((queue) => {
      setPendingCount(queue.length);
    });

    return () => {
      unsubscribe();
    };
  }, [updatePendingCount]);

  const handleSync = useCallback(async () => {
    if (!isOnline || syncState === 'syncing') return;

    const before = pendingCount;
    setSyncState('syncing');
    setSyncProgress({ current: 0, total: before });

    try {
      await offlineMutationQueue.replay(queryClient);
      const pending = await offlineMutationQueue.getPending();
      const after = pending.length;
      setSyncProgress({ current: before - after, total: before });
      setPendingCount(after);

      if (after < before) {
        // 队列减少：至少部分 mutation 已处理
        setSyncState('success');
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setSyncState('idle');
        }, 3000);
      } else if (before > 0) {
        // 队列未减少且有待处理项
        setSyncState('error');
      } else {
        setSyncState('idle');
      }
    } catch {
      setSyncState('error');
    }
  }, [isOnline, syncState, pendingCount, queryClient]);

  useEffect(() => {
    if (isOnline && pendingCount > 0 && syncState === 'idle') {
      const timer = setTimeout(() => {
        handleSync();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isOnline, pendingCount, syncState, handleSync]);

  const getBackgroundClass = () => {
    if (!isOnline) {
      return isDark
        ? 'bg-amber-900/95 border-amber-700'
        : 'bg-amber-500/95 border-amber-600';
    }
    if (syncState === 'syncing') {
      return isDark
        ? 'bg-primary-900/95 border-primary-700'
        : 'bg-primary-500/95 border-primary-600';
    }
    if (syncState === 'error') {
      return isDark
        ? 'bg-red-900/95 border-red-700'
        : 'bg-red-500/95 border-red-600';
    }
    if (showSuccess) {
      return isDark
        ? 'bg-emerald-900/95 border-emerald-700'
        : 'bg-emerald-500/95 border-emerald-600';
    }
    return isDark
      ? 'bg-slate-800/95 border-slate-700'
      : 'bg-slate-100/95 border-slate-300';
  };

  const getTextClass = () => {
    if (!isOnline || syncState === 'syncing' || syncState === 'error' || showSuccess) {
      return 'text-white';
    }
    return isDark ? 'text-slate-200' : 'text-slate-700';
  };

  const renderIcon = () => {
    if (syncState === 'syncing') {
      return <RefreshCw className="w-4 h-4 animate-spin" />;
    }
    if (syncState === 'error') {
      return <AlertCircle className="w-4 h-4" />;
    }
    if (showSuccess) {
      return <CheckCircle className="w-4 h-4" />;
    }
    if (!isOnline) {
      return <WifiOff className="w-4 h-4" />;
    }
    return <Wifi className="w-4 h-4" />;
  };

  const renderContent = () => {
    if (!isOnline) {
      return (
        <>
          <span className="text-sm font-medium">{t('common.offlineStatus.offlineMode')}</span>
          {pendingCount > 0 && (
            <span className="text-xs opacity-90">
              · {t('common.offlineStatus.pendingCount', { count: pendingCount })}
            </span>
          )}
        </>
      );
    }

    if (syncState === 'syncing') {
      return (
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-medium">{t('common.offlineStatus.syncing')}</span>
          {syncProgress.total > 0 && (
            <div className="flex-1 max-w-32">
              <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{
                    width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                  }}
                  transition={transitionOverride ?? { duration: 0.3 }}
                />
              </div>
              <span className="text-xs opacity-90 mt-1 block">
                {syncProgress.current}/{syncProgress.total}
              </span>
            </div>
          )}
        </div>
      );
    }

    if (syncState === 'error') {
      return (
        <>
          <span className="text-sm font-medium">{t('common.offlineStatus.syncFailed')}</span>
          <button
            onClick={handleSync}
            className="ml-2 text-xs underline hover:opacity-80 transition-opacity"
          >
            {t('common.offlineStatus.retry')}
          </button>
        </>
      );
    }

    if (showSuccess) {
      return (
        <span className="text-sm font-medium">{t('common.offlineStatus.syncComplete')}</span>
      );
    }

    if (pendingCount > 0) {
      return (
        <>
          <span className="text-sm font-medium">{t('common.offlineStatus.pendingCount', { count: pendingCount })}</span>
          <button
            onClick={handleSync}
            className="ml-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            {t('common.offlineStatus.syncNow')}
          </button>
        </>
      );
    }

    return null;
  };

  const shouldShow = !isOnline || pendingCount > 0 || syncState !== 'idle' || showSuccess;

  return (
    <AnimatePresence>
      {shouldShow && (
        <motion.div
          initial={reduceMotion ? { opacity: 0 } : { y: -100, opacity: 0 }}
          animate={reduceMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
          exit={reduceMotion ? { opacity: 0 } : { y: -100, opacity: 0 }}
          transition={transitionOverride ?? { type: 'spring', stiffness: 300, damping: 30 }}
          className={cn('fixed top-0 left-0 right-0 z-modal-overlay', getBackgroundClass(), getTextClass(), 'border-b backdrop-blur-sm shadow-lg')}
        >
          <div className="h-10 px-4 flex items-center justify-center gap-2">
            {renderIcon()}
            {renderContent()}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default OfflineStatusBar;
