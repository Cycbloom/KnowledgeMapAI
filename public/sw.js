const CACHE_NAME = 'knowledge-map-v1';
const STATIC_CACHE_NAME = 'knowledge-map-static-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // 手写 SW 不依赖 navigation preload，显式禁用以避免浏览器继续发起预载请求
    if (self.registration.navigationPreload) {
      try {
        await self.registration.navigationPreload.disable();
      } catch {
        // 旧浏览器不支持 navigationPreload，忽略
      }
    }

    // 清理非 v1 缓存（保留现有逻辑）
    const cacheNames = await caches.keys();

    // 额外清理 Workbox 残留缓存（workbox-precache-v2-*）
    const toDelete = cacheNames.filter(name =>
      !name.includes('v1') || name.startsWith('workbox-precache-v2-')
    );
    await Promise.all(toDelete.map(name => caches.delete(name)));

    // 注销同 scope 下非当前脚本的残留 SW 注册（清理历史 VitePWA/Workbox 残留）
    const registrations = await self.serviceWorker.getRegistrations();
    await Promise.all(
      registrations
        .filter(reg => reg.active && reg.active.scriptURL !== self.registration.active.scriptURL)
        .map(reg => reg.unregister())
    );

    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET') {
    return;
  }

  if (url.includes('/api/')) {
    // 安全优先：不缓存任何 API 响应，避免多账号/鉴权数据被 SW 缓存复用
    event.respondWith(
      fetch(request).catch(() => {
        return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' },
        });
      })
    );
    return;
  }

  if (request.destination === 'document') {
    event.respondWith((async () => {
      // 优先消费 navigation preload（若浏览器已发起），避免 preload 被取消的警告
      const preloaded = await event.preloadResponse;
      if (preloaded) {
        return preloaded;
      }
      try {
        return await fetch(request);
      } catch {
        return await caches.match('/index.html');
      }
    })());
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      return cached || fetch(request).then(response => {
        if (response.status === 200 && request.destination !== 'script' && request.destination !== 'style') {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data.type === 'clearCache') {
    event.waitUntil(
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames
            .filter(name => name.includes('api'))
            .map(name => caches.delete(name))
        );
      })
    );
  }

  if (event.data.type === 'prefetch') {
    const urls = event.data.urls || [];
    event.waitUntil(
      Promise.all(
        urls.map(url => fetch(url).catch(() => {}))
      )
    );
  }
});
