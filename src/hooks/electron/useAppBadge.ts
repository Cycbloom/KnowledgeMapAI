import { useCallback } from 'react';

export function useAppBadge() {
  const setBadge = useCallback((count: number) => {
    if (typeof window !== 'undefined' && window.electronAPI?.badge) {
      window.electronAPI.badge.set(count);
    }
  }, []);

  const clearBadge = useCallback(() => {
    if (typeof window !== 'undefined' && window.electronAPI?.badge) {
      window.electronAPI.badge.set(0);
    }
  }, []);

  return { setBadge, clearBadge };
}