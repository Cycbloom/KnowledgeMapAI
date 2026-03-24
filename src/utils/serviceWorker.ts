interface ServiceWorkerConfig {
  onUpdate?: (registration: ServiceWorkerRegistration) => void;
  onSuccess?: (registration: ServiceWorkerRegistration) => void;
  onOffline?: () => void;
  onOnline?: () => void;
}

export const registerServiceWorker = async (config: ServiceWorkerConfig = {}): Promise<ServiceWorkerRegistration | null> => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const installingWorker = registration.installing;
        if (installingWorker) {
          installingWorker.addEventListener('statechange', () => {
            if (installingWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('[SW] New content available, please refresh.');
                if (config.onUpdate) {
                  config.onUpdate(registration);
                }
              } else {
                console.log('[SW] Content cached for offline use.');
                if (config.onSuccess) {
                  config.onSuccess(registration);
                }
              }
            }
          });
        }
      });

      window.addEventListener('online', () => {
        console.log('[SW] Back online');
        if (config.onOnline) {
          config.onOnline();
        }
      });

      window.addEventListener('offline', () => {
        console.log('[SW] Gone offline');
        if (config.onOffline) {
          config.onOffline();
        }
      });

      return registration;
    } catch (error) {
      console.error('[SW] Registration failed:', error);
      return null;
    }
  }

  return null;
};

export const unregisterServiceWorker = async (): Promise<boolean> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    return registration.unregister();
  }
  return false;
};

export const updateServiceWorker = async (): Promise<void> => {
  if ('serviceWorker' in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
  }
};

export const clearApiCache = async (): Promise<void> => {
  // API 缓存策略已收敛为“默认不缓存 API”。这里做两件事：
  // 1) 通知 SW 清理历史遗留的 api 缓存（如果存在）
  // 2) 在页面侧尽力删除可能残留的 api cache storage
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'clearCache' });
  }

  if ('caches' in window) {
    try {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name.includes('api') || name.includes('knowledge-map-api'))
          .map((name) => caches.delete(name)),
      );
    } catch {
      // ignore
    }
  }
};

export const prefetchUrls = async (urls: string[]): Promise<void> => {
  // 预热请求：只做网络预取，不做持久缓存（与 sw.js 的“API 不缓存”一致）
  const uniqueUrls = Array.from(new Set(urls)).filter(Boolean);
  if (uniqueUrls.length === 0) return;

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'prefetch', urls: uniqueUrls });
    return;
  }

  await Promise.all(
    uniqueUrls.map((url) =>
      fetch(url, { credentials: 'include' }).catch(() => undefined),
    ),
  );
};

export const getServiceWorkerStatus = async (): Promise<{
  isSupported: boolean;
  isRegistered: boolean;
  isControlling: boolean;
  scope?: string;
}> => {
  const result = {
    isSupported: 'serviceWorker' in navigator,
    isRegistered: false,
    isControlling: false,
    scope: undefined as string | undefined,
  };

  if (result.isSupported) {
    const registration = await navigator.serviceWorker.getRegistration();
    result.isRegistered = !!registration;
    result.isControlling = !!navigator.serviceWorker.controller;
    result.scope = registration?.scope;
  }

  return result;
};
