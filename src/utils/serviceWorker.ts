/**
 * Service Worker 工具函数
 *
 * 注册入口由 `virtual:pwa-register/react` 的 `useRegisterSW`（React Hook）承担，
 * 在组件层调用。本文件仅提供与 SW / Cache Storage 交互的工具函数，
 * 供 main.tsx 启动逻辑、UpdatePrompt 组件及其他业务代码使用。
 */

export interface ServiceWorkerStatus {
  registered: boolean;
  active: boolean;
  waiting: boolean;
  controller: boolean;
}

const isBrowserEnvironment = (): boolean =>
  typeof navigator !== 'undefined' && 'serviceWorker' in navigator;

const isCachesSupported = (): boolean =>
  typeof window !== 'undefined' && 'caches' in window;

/**
 * 清理 API / Supabase 相关缓存。
 *
 * 通过 `caches.keys()` 过滤包含 "api" 或 "supabase" 的缓存并删除。
 * SSR 安全：仅在浏览器环境且支持 Cache Storage 时执行。
 */
export const clearApiCache = async (): Promise<void> => {
  if (!isCachesSupported()) return;

  try {
    const names = await caches.keys();
    await Promise.all(
      names
        .filter((name) => name.includes('api') || name.includes('supabase'))
        .map((name) => caches.delete(name)),
    );
  } catch (error) {
    console.error('[SW] clearApiCache failed:', error);
  }
};

/**
 * 通过 Service Worker 预取指定 URL 列表。
 *
 * 经 `navigator.serviceWorker.ready` 获取激活的 SW，向其 postMessage
 * `{ type: 'PREFETCH', urls }` 触发 SW 端的预取逻辑。
 */
export const prefetchUrls = async (urls: string[]): Promise<void> => {
  const uniqueUrls = Array.from(new Set(urls)).filter(Boolean);
  if (uniqueUrls.length === 0) return;

  if (!isBrowserEnvironment()) return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const active = registration.active;
    if (!active) return;
    active.postMessage({ type: 'PREFETCH', urls: uniqueUrls });
  } catch (error) {
    console.error('[SW] prefetchUrls failed:', error);
  }
};

/**
 * 获取当前 Service Worker 的状态。
 *
 * 基于 `navigator.serviceWorker.getRegistration()` 与 `navigator.serviceWorker.controller`。
 */
export const getServiceWorkerStatus = async (): Promise<ServiceWorkerStatus> => {
  const status: ServiceWorkerStatus = {
    registered: false,
    active: false,
    waiting: false,
    controller: false,
  };

  if (!isBrowserEnvironment()) return status;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    status.registered = !!registration;
    status.active = !!registration?.active;
    status.waiting = !!registration?.waiting;
    status.controller = !!navigator.serviceWorker.controller;
  } catch (error) {
    console.error('[SW] getServiceWorkerStatus failed:', error);
  }

  return status;
};

/**
 * 触发等待中的 Service Worker 跳过等待并重新加载页面。
 *
 * 通过 postMessage `{ type: 'SKIP_WAITING' }` 通知 waiting SW 立即激活，
 * 随后调用 `window.location.reload()` 加载新版本。
 */
export const updateServiceWorker = async (): Promise<void> => {
  if (!isBrowserEnvironment()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    registration?.waiting?.postMessage({ type: 'SKIP_WAITING' });
  } catch (error) {
    console.error('[SW] updateServiceWorker failed:', error);
  }

  if (typeof window !== 'undefined') {
    window.location.reload();
  }
};

/**
 * 注销当前作用域下所有 Service Worker 并清空所有 Cache Storage。
 *
 * 通过 `navigator.serviceWorker.getRegistrations()` 获取所有注册，
 * 逐个调用 `registration.unregister()`，然后清空 Cache Storage。
 * 用于完全退出 PWA 模式或排查缓存问题。
 */
export const unregisterServiceWorker = async (): Promise<void> => {
  if (!isBrowserEnvironment()) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((reg) => reg.unregister()));
  } catch (error) {
    console.error('[SW] unregisterServiceWorker failed:', error);
  }

  if (isCachesSupported()) {
    try {
      const names = await caches.keys();
      await Promise.all(names.map((name) => caches.delete(name)));
    } catch (error) {
      console.error('[SW] clear caches failed:', error);
    }
  }
};

/**
 * 注销旧版手写 `/sw.js` Service Worker 及其遗留缓存。
 *
 * 该函数用于从历史版本（基于 public/sw.js + 自管 Cache Storage）迁移到
 * VitePWA + Workbox 注册体系时清理残留：
 * 1. 通过 `getRegistration('/sw.js')` 查找旧 SW 并注销；
 * 2. 删除旧缓存：`knowledge-map-v1`、`knowledge-map-static-v1`、
 *    `workbox-precache-v2-/`（清理 Workbox 残留）。
 *
 * 仅在浏览器环境执行；fire-and-forget 调用，不阻塞应用启动。
 */
export const unregisterLegacySW = async (): Promise<void> => {
  if (!isBrowserEnvironment()) return;

  try {
    const legacyReg = await navigator.serviceWorker.getRegistration('/sw.js');
    if (legacyReg) {
      await legacyReg.unregister();
    }
  } catch (error) {
    console.error('[SW] unregister legacy /sw.js failed:', error);
  }

  if (!isCachesSupported()) return;

  const legacyCacheNames = [
    'knowledge-map-v1',
    'knowledge-map-static-v1',
    'workbox-precache-v2-/',
  ];

  try {
    await Promise.all(legacyCacheNames.map((name) => caches.delete(name)));
  } catch (error) {
    console.error('[SW] clear legacy caches failed:', error);
  }
};
