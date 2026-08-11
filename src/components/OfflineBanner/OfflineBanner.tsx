import { useEffect, useState, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CloudOff, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNetworkStatus } from '@/hooks/common/useNetworkStatus';
import { offlineMutationQueue } from '@/utils/offlineMutations';
import { cn } from '@/utils/utils';
import { message } from '@/utils/messageHelper';
import { ErrorBanner } from '@/components/common/ErrorBanner';
import { frontendEventBus } from '@/services/timer/FrontendEventBus';
import type { SyncProgressPayload } from '@/services/FrontendEventTypes';

const OFFLINE_TOAST_DURATION = 5000; // 5 秒后从 toast 切换为 banner

/**
 * 离线状态横幅
 *
 * - 渐进式错误提示：
 *   - 网络断开 < 5 秒：Toast 提示
 *   - 网络断开 >= 5 秒：切换为持久 Banner
 * - 网络恢复后显示实际同步进度（来自 sync_progress 事件）
 * - 同步完成后显示结果（成功/失败），3 秒后自动消失
 * - 完全在线且无 pending 时不渲染
 */
export function OfflineBanner() {
  const { online } = useNetworkStatus();
  const { t } = useTranslation();
  const [pendingCount, setPendingCount] = useState(0);
  const [wasOffline, setWasOffline] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [bannerVisible, setBannerVisible] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number } | null>(null);
  const [syncResult, setSyncResult] = useState<'success' | 'error' | null>(null);
  const offlineStartRef = useRef<number | null>(null);
  const toastShownRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 订阅离线 mutation 队列变化
  useEffect(() => {
    const unsubscribe = offlineMutationQueue.subscribe((queue) => {
      setPendingCount(queue.length);
    });
    return unsubscribe;
  }, []);

  // 订阅同步进度事件
  useEffect(() => {
    const unsubscribe = frontendEventBus.subscribe('sync_progress', (payload: SyncProgressPayload) => {
      setSyncProgress({ current: payload.current, total: payload.total });
      if (payload.status === 'success') {
        setSyncResult('success');
      } else if (payload.status === 'error') {
        setSyncResult('error');
      }
      // 所有项处理完毕，同步结束
      if (payload.current >= payload.total) {
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
        }
        syncTimerRef.current = setTimeout(() => {
          setSyncing(false);
          setSyncProgress(null);
          setSyncResult(null);
          setWasOffline(false);
        }, 3000);
      }
    });
    return () => {
      unsubscribe();
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
    };
  }, []);

  // 跟踪离线状态，网络恢复后开始同步
  useEffect(() => {
    if (!online) {
      setWasOffline(true);
      setSyncing(false);
      return;
    }

    if (wasOffline) {
      setSyncing(true);
      // 如果没有及时收到 sync_progress 事件，5 秒后自动退出同步状态
      if (syncTimerRef.current) {
        clearTimeout(syncTimerRef.current);
      }
      syncTimerRef.current = setTimeout(() => {
        setSyncing(false);
        setSyncProgress(null);
        setSyncResult(null);
        setWasOffline(false);
      }, 5000);
      return () => {
        if (syncTimerRef.current) {
          clearTimeout(syncTimerRef.current);
        }
      };
    }

    return undefined;
  }, [online, wasOffline]);

  // 离线时长跟踪与渐进式提示
  useEffect(() => {
    if (!online) {
      if (offlineStartRef.current === null) {
        offlineStartRef.current = Date.now();
        toastShownRef.current = false;
        setBannerVisible(false);
      }

      // 每秒检查离线时长
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - (offlineStartRef.current ?? Date.now());

        if (elapsed < OFFLINE_TOAST_DURATION) {
          // 离线 < 5 秒：显示 toast（仅一次）
          if (!toastShownRef.current) {
            toastShownRef.current = true;
            message.warning(t('offlineBanner.message.offlineHint'), {
              duration: OFFLINE_TOAST_DURATION,
            });
          }
        } else {
          // 离线 >= 5 秒：切换为持久 banner
          setBannerVisible(true);
        }
      }, 1000);

      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }

    // 网络恢复：重置状态
    offlineStartRef.current = null;
    toastShownRef.current = false;
    setBannerVisible(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return undefined;
  }, [online, t]);

  // 完全在线且无 pending 且非 syncing：不渲染
  if (online && !wasOffline && pendingCount === 0) {
    return null;
  }

  const isOffline = !online;
  const isSyncing = online && syncing;
  const showBanner = isOffline && bannerVisible;
  const showLegacyBanner = isOffline && !bannerVisible;

  // 离线且已切换为 ErrorBanner banner 模式
  if (showBanner) {
    return (
      <ErrorBanner
        level="banner"
        title={t('offlineBanner.message.offlineHint')}
        message={t('offlineBanner.status.pendingSync')}
        action={
          pendingCount > 0
            ? {
                label: t('offlineBanner.message.pendingCount', {
                  count: pendingCount,
                }),
                onClick: () => {},
              }
            : undefined
        }
      />
    );
  }

  // 旧版渲染：离线 < 5 秒（仍显示薄横幅）、同步中、pending 同步
  let bannerMessage: string;
  let icon: ReactNode;
  let bgColor: string;
  let progressBar: ReactNode = null;

  if (isOffline && showLegacyBanner) {
    bannerMessage = t('offlineBanner.message.offlineHint');
    icon = <CloudOff className="h-4 w-4" />;
    bgColor = 'bg-amber-500';
  } else if (isSyncing) {
    bannerMessage = syncResult === 'success'
      ? t('offlineBanner.message.syncComplete')
      : syncResult === 'error'
        ? t('offlineBanner.message.syncFailed')
        : t('offlineBanner.message.syncingHint');
    icon = syncResult === 'success'
      ? <CheckCircle className="h-4 w-4" />
      : syncResult === 'error'
        ? <AlertCircle className="h-4 w-4" />
        : <RefreshCw className="h-4 w-4 animate-spin" />;
    bgColor = syncResult === 'success'
      ? 'bg-emerald-500'
      : syncResult === 'error'
        ? 'bg-red-500'
        : 'bg-blue-500';
    // 同步中且有进度信息时显示进度条
    if (syncProgress && syncProgress.total > 0 && !syncResult) {
      const percent = Math.round((syncProgress.current / syncProgress.total) * 100);
      progressBar = (
        <div className="flex items-center gap-2 ml-2 flex-1 max-w-48">
          <div className="flex-1 h-1.5 bg-white/30 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-white rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
          <span className="text-xs opacity-90 whitespace-nowrap">
            {syncProgress.current}/{syncProgress.total}
          </span>
        </div>
      );
    }
  } else {
    // 在线但有 pending（非 syncing 状态）
    bannerMessage = t('offlineBanner.status.pendingSync');
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
          <span className="text-sm font-medium">{bannerMessage}</span>
          {progressBar}
        </div>
        {pendingCount > 0 && !isSyncing && (
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