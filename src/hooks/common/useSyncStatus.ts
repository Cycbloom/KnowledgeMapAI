import { useState, useEffect, useCallback } from 'react';
import { isLocalDbAvailable, getSyncStatus, triggerSync, onSyncStatusChanged } from '../../services/api/localClient';
import type { SyncStatus } from '../../../shared/types/ipc';

export function useSyncStatus() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [isLocalAvailable, setIsLocalAvailable] = useState(false);

  useEffect(() => {
    let mounted = true;

    // Check if local DB is available
    isLocalDbAvailable().then(available => {
      if (!mounted) return;
      setIsLocalAvailable(available);
      if (available) {
        // Get initial status
        getSyncStatus().then(s => {
          if (mounted && s) setStatus(s as SyncStatus);
        });
      }
    });

    // Subscribe to status changes
    const unsubscribe = onSyncStatusChanged((newStatus) => {
      if (mounted) setStatus(newStatus as SyncStatus);
    });

    // Poll status every 30 seconds as fallback（页面隐藏时暂停，恢复可见后下一轮自动续跑）
    const interval = setInterval(() => {
      if (document.hidden) return;
      if (isLocalAvailable) {
        getSyncStatus().then(s => {
          if (mounted && s) setStatus(s as SyncStatus);
        });
      }
    }, 30000);

    return () => {
      mounted = false;
      unsubscribe();
      clearInterval(interval);
    };
  }, [isLocalAvailable]);

  const manualSync = useCallback(async () => {
    return triggerSync();
  }, []);

  return {
    status,
    isLocalAvailable,
    manualSync,
  };
}
