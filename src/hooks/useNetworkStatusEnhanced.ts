import { useState, useEffect, useCallback } from 'react';

interface NetworkInformation extends EventTarget {
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
  onchange?: EventListener;
}

interface NavigatorWithConnection extends Navigator {
  connection?: NetworkInformation;
}

interface NetworkStatus {
  isOnline: boolean;
  isSlowConnection: boolean;
  effectiveType: string;
  downlink: number;
  rtt: number;
  lastOnlineTime: Date | null;
  lastOfflineTime: Date | null;
}

interface NetworkStatusOptions {
  onOnline?: () => void;
  onOffline?: () => void;
  onSlowConnection?: () => void;
  slowThreshold?: number;
}

const getInitialConnectionInfo = () => {
  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0,
  };
};

export const useNetworkStatus = (options: NetworkStatusOptions = {}) => {
  const { onOnline, onOffline, onSlowConnection, slowThreshold = 500 } = options;

  const [status, setStatus] = useState<NetworkStatus>({
    isOnline: navigator.onLine,
    isSlowConnection: false,
    ...getInitialConnectionInfo(),
    lastOnlineTime: navigator.onLine ? new Date() : null,
    lastOfflineTime: navigator.onLine ? null : new Date(),
  });

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const startTime = Date.now();
      const response = await fetch('/api/health/system', {
        method: 'HEAD',
        cache: 'no-store',
      });
      const latency = Date.now() - startTime;

      setStatus((prev) => ({
        ...prev,
        isSlowConnection: latency > slowThreshold,
      }));

      if (latency > slowThreshold && onSlowConnection) {
        onSlowConnection();
      }

      return response.ok;
    } catch {
      return false;
    }
  }, [slowThreshold, onSlowConnection]);

  useEffect(() => {
    const handleOnline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: true,
        lastOnlineTime: new Date(),
      }));
      if (onOnline) {
        onOnline();
      }
    };

    const handleOffline = () => {
      setStatus((prev) => ({
        ...prev,
        isOnline: false,
        lastOfflineTime: new Date(),
      }));
      if (onOffline) {
        onOffline();
      }
    };

    const connection = (navigator as NavigatorWithConnection).connection;

    const handleConnectionChange = () => {
      if (connection) {
        setStatus((prev) => ({
          ...prev,
          effectiveType: connection.effectiveType || 'unknown',
          downlink: connection.downlink || 0,
          rtt: connection.rtt || 0,
          isSlowConnection:
            connection.effectiveType === 'slow-2g' ||
            connection.effectiveType === '2g' ||
            (connection.rtt || 0) > slowThreshold,
        }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (connection) {
      connection.addEventListener('change', handleConnectionChange);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (connection) {
        connection.removeEventListener('change', handleConnectionChange);
      }
    };
  }, [onOnline, onOffline, slowThreshold]);

  return {
    ...status,
    checkConnection,
  };
};

export const useRetryOnReconnect = <T>(
  fetchFn: () => Promise<T>,
  options: { maxRetries?: number; retryDelay?: number } = {}
) => {
  const { maxRetries = 3, retryDelay: _retryDelay = 1000 } = options;
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { isOnline } = useNetworkStatus({
    onOnline: async () => {
      if (retryCount < maxRetries) {
        setIsRetrying(true);
        try {
          await fetchFn();
          setRetryCount(0);
        } catch {
          setRetryCount((prev) => prev + 1);
        } finally {
          setIsRetrying(false);
        }
      }
    },
  });

  const retry = useCallback(async () => {
    if (!isOnline) {
      return;
    }

    setIsRetrying(true);
    try {
      await fetchFn();
      setRetryCount(0);
    } catch {
      setRetryCount((prev) => prev + 1);
    } finally {
      setIsRetrying(false);
    }
  }, [fetchFn, isOnline]);

  return {
    retry,
    isRetrying,
    retryCount,
    canRetry: isOnline && retryCount < maxRetries,
  };
};
