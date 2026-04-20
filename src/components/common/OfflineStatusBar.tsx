import React, { useState, useEffect, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { WifiOff, Wifi, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useNetworkStatus } from '../../hooks/common/useNetworkStatus';
import { useTheme } from '../../hooks';
import {
  getSyncStatus,
  syncOfflineQueue,
} from '../../utils/backgroundSync';
import { getOfflineQueueCount } from '../../utils/offlineStorage';
import { frontendEventBus } from '../../services/timer/FrontendEventBus';

type SyncState = 'idle' | 'syncing' | 'success' | 'error';

export const OfflineStatusBar: React.FC = () => {
  const { isOnline } = useNetworkStatus();
  const { isDark } = useTheme();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const [showSuccess, setShowSuccess] = useState(false);

  const updatePendingCount = useCallback(async () => {
    try {
      const status = await getSyncStatus();
      setPendingCount(status.pendingCount);
    } catch {
      const count = await getOfflineQueueCount();
      setPendingCount(count);
    }
  }, []);

  useEffect(() => {
    updatePendingCount();

    const unsubscribeQueue = frontendEventBus.subscribe('sync_queue_updated', (data) => {
      const queueData = data as { pendingCount?: number };
      if (typeof queueData.pendingCount === 'number') {
        setPendingCount(queueData.pendingCount);
      } else {
        updatePendingCount();
      }
    });

    const unsubscribeSyncStart = frontendEventBus.subscribe('sync_started', () => {
      setSyncState('syncing');
    });

    const unsubscribeSyncComplete = frontendEventBus.subscribe('sync_completed', (data) => {
      const result = data as { success: number; failed: number };
      if (result.failed > 0) {
        setSyncState('error');
      } else if (result.success > 0) {
        setSyncState('success');
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setSyncState('idle');
        }, 3000);
      } else {
        setSyncState('idle');
      }
      updatePendingCount();
    });

    return () => {
      unsubscribeQueue();
      unsubscribeSyncStart();
      unsubscribeSyncComplete();
    };
  }, [updatePendingCount]);

  const handleSync = useCallback(async () => {
    if (!isOnline || syncState === 'syncing') return;

    setSyncState('syncing');
    setSyncProgress({ current: 0, total: pendingCount });

    try {
      const result = await syncOfflineQueue();
      setSyncProgress({ current: result.success + result.failed, total: pendingCount });

      if (result.failed > 0) {
        setSyncState('error');
      } else if (result.success > 0) {
        setSyncState('success');
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          setSyncState('idle');
        }, 3000);
      } else {
        setSyncState('idle');
      }

      updatePendingCount();
    } catch {
      setSyncState('error');
    }
  }, [isOnline, syncState, pendingCount, updatePendingCount]);

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
        ? 'bg-blue-900/95 border-blue-700'
        : 'bg-blue-500/95 border-blue-600';
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
          <span className="text-sm font-medium">离线模式</span>
          {pendingCount > 0 && (
            <span className="text-xs opacity-90">
              · {pendingCount} 项待同步
            </span>
          )}
        </>
      );
    }

    if (syncState === 'syncing') {
      return (
        <div className="flex items-center gap-3 flex-1">
          <span className="text-sm font-medium">正在同步...</span>
          {syncProgress.total > 0 && (
            <div className="flex-1 max-w-32">
              <div className="h-1.5 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                  }}
                  transition={{ duration: 0.3 }}
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
          <span className="text-sm font-medium">同步失败</span>
          <button
            onClick={handleSync}
            className="ml-2 text-xs underline hover:opacity-80 transition-opacity"
          >
            重试
          </button>
        </>
      );
    }

    if (showSuccess) {
      return (
        <span className="text-sm font-medium">同步完成</span>
      );
    }

    if (pendingCount > 0) {
      return (
        <>
          <span className="text-sm font-medium">{pendingCount} 项待同步</span>
          <button
            onClick={handleSync}
            className="ml-2 flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            立即同步
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
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className={`fixed top-0 left-0 right-0 z-[60] ${getBackgroundClass()} ${getTextClass()} border-b backdrop-blur-sm shadow-lg`}
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
