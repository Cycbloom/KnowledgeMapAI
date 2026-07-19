import { useState, useEffect, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';
import { isElectronProduction, getElectronApiUrl } from '../../config/electronConfig';

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

export interface NetworkStatusOptions {
  enableSlowDetection?: boolean;
  enableHealthCheck?: boolean;
  slowThreshold?: number;
  onOnline?: () => void;
  onOffline?: () => void;
  onSlowConnection?: () => void;
}

export interface NetworkStatusResult {
  online: boolean;
  isOnline: boolean;
  connectionType: string | undefined;
  isSlowConnection?: boolean;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  lastOnlineTime?: Date | null;
  lastOfflineTime?: Date | null;
  checkConnection?: () => Promise<boolean>;
}

const getInitialConnectionInfo = () => {
  const connection = (navigator as NavigatorWithConnection).connection;
  return {
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 0,
    rtt: connection?.rtt || 0,
  };
};

export function useNetworkStatus(options: NetworkStatusOptions = {}): NetworkStatusResult {
  const {
    enableSlowDetection = false,
    enableHealthCheck = false,
    slowThreshold = 500,
    onOnline,
    onOffline,
    onSlowConnection,
  } = options;

  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string | undefined>();

  const [enhancedState, setEnhancedState] = useState<{
    isSlowConnection: boolean;
    effectiveType: string;
    downlink: number;
    rtt: number;
    lastOnlineTime: Date | null;
    lastOfflineTime: Date | null;
  }>(() => ({
    isSlowConnection: false,
    ...getInitialConnectionInfo(),
    lastOnlineTime: navigator.onLine ? new Date() : null,
    lastOfflineTime: navigator.onLine ? null : new Date(),
  }));

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!enableHealthCheck) {
      return isOnline;
    }

    try {
      const startTime = Date.now();

      let healthUrl: string;
      if (isElectronProduction()) {
        const electronApiUrl = await getElectronApiUrl();
        healthUrl = `${electronApiUrl}/health/system`;
      } else {
        healthUrl = '/api/health/system';
      }

      const response = await fetch(healthUrl, {
        method: 'HEAD',
        cache: 'no-store',
      });
      const latency = Date.now() - startTime;

      if (enableSlowDetection) {
        setEnhancedState((prev) => ({
          ...prev,
          isSlowConnection: latency > slowThreshold,
        }));

        if (latency > slowThreshold && onSlowConnection) {
          onSlowConnection();
        }
      }

      return response.ok;
    } catch {
      return false;
    }
  }, [enableHealthCheck, isOnline, enableSlowDetection, slowThreshold, onSlowConnection]);

  useEffect(() => {
    let isMounted = true;

    const initializeNetworkStatus = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const status = await Network.getStatus();
          if (isMounted) {
            setIsOnline(status.connected);
            setConnectionType(status.connectionType);

            if (enableSlowDetection) {
              setEnhancedState((prev) => ({
                ...prev,
                lastOnlineTime: status.connected ? new Date() : prev.lastOnlineTime,
                lastOfflineTime: !status.connected ? new Date() : prev.lastOfflineTime,
              }));
            }
          }
        } else {
          if (isMounted) {
            setIsOnline(navigator.onLine);
          }
        }
      } catch {
        if (isMounted) {
          setIsOnline(navigator.onLine);
        }
      }
    };

    initializeNetworkStatus();

    let cleanupListener: (() => void) | undefined;

    const setupNetworkListener = async () => {
      if (Capacitor.isNativePlatform()) {
        const handle = await Network.addListener('networkStatusChange', (status) => {
          if (isMounted) {
            setIsOnline(status.connected);
            setConnectionType(status.connectionType);

            if (enableSlowDetection) {
              setEnhancedState((prev) => ({
                ...prev,
                lastOnlineTime: status.connected ? new Date() : prev.lastOnlineTime,
                lastOfflineTime: !status.connected ? new Date() : prev.lastOfflineTime,
              }));

              if (status.connected && onOnline) {
                onOnline();
              } else if (!status.connected && onOffline) {
                onOffline();
              }
            }
          }
        });
        cleanupListener = () => handle.remove();
      } else {
        const handleOnline = () => {
          if (isMounted) {
            setIsOnline(true);
            setConnectionType('unknown');

            if (enableSlowDetection) {
              setEnhancedState((prev) => ({
                ...prev,
                lastOnlineTime: new Date(),
              }));

              if (onOnline) {
                onOnline();
              }
            }
          }
        };

        const handleOffline = () => {
          if (isMounted) {
            setIsOnline(false);
            setConnectionType('none');

            if (enableSlowDetection) {
              setEnhancedState((prev) => ({
                ...prev,
                lastOfflineTime: new Date(),
              }));

              if (onOffline) {
                onOffline();
              }
            }
          }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        cleanupListener = () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };

        if (enableSlowDetection) {
          const connection = (navigator as NavigatorWithConnection).connection;

          const handleConnectionChange = () => {
            if (connection && isMounted) {
              const isSlow =
                connection.effectiveType === 'slow-2g' ||
                connection.effectiveType === '2g' ||
                (connection.rtt || 0) > slowThreshold;

              setEnhancedState((prev) => ({
                ...prev,
                effectiveType: connection.effectiveType || 'unknown',
                downlink: connection.downlink || 0,
                rtt: connection.rtt || 0,
                isSlowConnection: isSlow,
              }));

              if (isSlow && onSlowConnection) {
                onSlowConnection();
              }
            }
          };

          if (connection) {
            connection.addEventListener('change', handleConnectionChange);
          }

          const originalCleanup = cleanupListener;
          cleanupListener = () => {
            originalCleanup();
            if (connection) {
              connection.removeEventListener('change', handleConnectionChange);
            }
          };
        }
      }
    };

    setupNetworkListener();

    return () => {
      isMounted = false;
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, [enableSlowDetection, slowThreshold, onOnline, onOffline, onSlowConnection]);

  const baseResult: NetworkStatusResult = {
    online: isOnline,
    isOnline,
    connectionType,
  };

  if (!enableSlowDetection && !enableHealthCheck) {
    return baseResult;
  }

  return {
    ...baseResult,
    ...(enableSlowDetection && {
      isSlowConnection: enhancedState.isSlowConnection,
      effectiveType: enhancedState.effectiveType,
      downlink: enhancedState.downlink,
      rtt: enhancedState.rtt,
      lastOnlineTime: enhancedState.lastOnlineTime,
      lastOfflineTime: enhancedState.lastOfflineTime,
    }),
    ...(enableHealthCheck && {
      checkConnection,
    }),
  };
}

export const useRetryOnReconnect = <T>(
  fetchFn: () => Promise<T>,
  options: { maxRetries?: number; retryDelay?: number } = {}
) => {
  const { maxRetries = 3, retryDelay: _retryDelay = 1000 } = options;
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  const { isOnline } = useNetworkStatus({
    enableSlowDetection: false,
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
}

// 独立的网络状态订阅函数（非 hook），供 React Query onlineManager 等场景使用。
// 复用 useNetworkStatus 的网络监听逻辑（Capacitor Network + window online/offline）。
export function subscribeNetworkStatus(
  callback: (status: NetworkStatusResult) => void,
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let isCancelled = false;
  let cleanupListener: (() => void) | undefined;

  const emit = (
    connected: boolean,
    connectionType: string | undefined = undefined,
  ) => {
    if (isCancelled) return;
    callback({
      online: connected,
      isOnline: connected,
      connectionType,
    });
  };

  const setup = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const status = await Network.getStatus();
        if (isCancelled) return;
        emit(status.connected, status.connectionType);

        const handle = await Network.addListener('networkStatusChange', (newStatus) => {
          if (isCancelled) return;
          emit(newStatus.connected, newStatus.connectionType);
        });
        if (isCancelled) {
          void handle.remove();
          return;
        }
        cleanupListener = () => {
          void handle.remove();
        };
      } else {
        emit(navigator.onLine);

        const handleOnline = () => emit(true, 'unknown');
        const handleOffline = () => emit(false, 'none');

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        cleanupListener = () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
    } catch {
      if (!isCancelled && typeof navigator !== 'undefined') {
        emit(navigator.onLine);
      }
    }
  };

  void setup();

  return () => {
    isCancelled = true;
    if (cleanupListener) {
      cleanupListener();
      cleanupListener = undefined;
    }
  };
}
