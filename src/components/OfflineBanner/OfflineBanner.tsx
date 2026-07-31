import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '@/hooks/common/useNetworkStatus';
import { offlineMutationQueue } from '@/utils/offlineMutations';
import { cn } from '@/lib/utils';

/**
 * 离线状态横幅
 *
 * - 离线时顶部固定显示，含 pending 操作计数
 * - 网络恢复后短暂显示 "同步中..." 状态（2 秒）
 * - 完全在线且无 pending 时不渲染
 */
export function OfflineBanner() {
  const { online } = useNetworkStatus();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // 订阅离线 mutation 队列变化
  useEffect(() => {
    const unsubscribe = offlineMutationQueue.subscribe((queue) => {
      setPendingCount(queue.length);
    });
    return unsubscribe;
  }, []);

  // 跟踪离线状态，网络恢复后短暂显示 "同步中..."
  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setSyncing(false);
      return;
    }

    if (wasOffline) {
      setSyncing(true);
      const timer = setTimeout(() => {
        setSyncing(false);
        setWasOffline(false);
      }, 2000);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [online, wasOffline]);

  // 完全在线且无 pending 且非 syncing：不渲染
  if (online && !wasOffline && pendingCount === 0) {
    return null;
  }

  const isOffline = !online;
  const isSyncing = online && syncing;

  let message: string;
  let icon: ReactNode;
  let bgColor: string;

  if (isOffline) {
    message = t('offlineBanner.message.offlineHint');
    icon = <CloudOff className="h-4 w-4" />;
    bgColor = 'bg-amber-500';
  } else if (isSyncing) {
    message = t('offlineBanner.message.syncingHint');
    icon = <RefreshCw className="h-4 w-4 animate-spin" />;
    bgColor = 'bg-blue-500';
  } else {
    // 在线但有 pending（非 syncing 状态）
    message = t('offlineBanner.status.pendingSync');
    icon = <RefreshCw className="h-4 w-4" />;
    bgColor = 'bg-blue-500';
  }

  return (
    <AnimatePresence>
      <motion.div
        data-testid="offline-banner"
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className={cn(
          'fixed top-0 left-0 right-0 z-50 px-4 py-2 flex items-center justify-between text-white shadow-lg',
          bgColor,
        )}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium">{message}</span>
        </div>
        {pendingCount > 0 && (
          <span
            data-testid="offline-banner-pending"
            className="text-sm font-bold"
          >
            {t('offlineBanner.message.pendingCount', { count: pendingCount })}
          </span>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
