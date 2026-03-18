import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Network } from '@capacitor/network';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(true);
  const [connectionType, setConnectionType] = useState<string | undefined>();

  useEffect(() => {
    let isMounted = true;

    const initializeNetworkStatus = async () => {
      try {
        if (Capacitor.isNativePlatform()) {
          const status = await Network.getStatus();
          if (isMounted) {
            setIsOnline(status.connected);
            setConnectionType(status.connectionType);
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
          }
        });
        cleanupListener = () => handle.remove();
      } else {
        const handleOnline = () => {
          if (isMounted) {
            setIsOnline(true);
            setConnectionType('unknown');
          }
        };
        const handleOffline = () => {
          if (isMounted) {
            setIsOnline(false);
            setConnectionType('none');
          }
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        cleanupListener = () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
        };
      }
    };

    setupNetworkListener();

    return () => {
      isMounted = false;
      if (cleanupListener) {
        cleanupListener();
      }
    };
  }, []);

  return { isOnline, connectionType };
}
