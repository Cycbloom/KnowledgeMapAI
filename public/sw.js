const CACHE_NAME = 'knowledge-map-v1';
const STATIC_CACHE_NAME = 'knowledge-map-static-v1';
const API_CACHE_NAME = 'knowledge-map-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.svg',
];

const API_CACHE_PATTERNS = [
  /\/api\/graphs$/,
  /\/api\/graphs\/[^/]+$/,
  /\/api\/graphs\/[^/]+\/nodes$/,
  /\/api\/templates$/,
  /\/api\/auth\/user$/,
];

const CACHE_STRATEGIES = {
  networkFirst: ['/api/auth/', '/api/ai/', '/api/study/'],
  cacheFirst: ['/api/templates'],
  staleWhileRevalidate: ['/api/graphs'],
};

const shouldCacheApi = (url: string): boolean => {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
};

const getCacheStrategy = (url: string): 'networkFirst' | 'cacheFirst' | 'staleWhileRevalidate' => {
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => url.includes(pattern))) {
      return strategy as 'networkFirst' | 'cacheFirst' | 'staleWhileRevalidate';
    }
  }
  return 'networkFirst';
};

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => !name.includes('v1'))
          .map(name => caches.delete(name))
      );
    })
  );
  (self as unknown as ServiceWorkerGlobalScope).clients.claim();
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  const url = request.url;

  if (request.method !== 'GET') {
    return;
  }

  if (url.includes('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  if (request.destination === 'document') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/index.html'))
    );
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

async function handleApiRequest(request: Request): Promise<Response> {
  const url = request.url;
  const strategy = getCacheStrategy(url);

  switch (strategy) {
    case 'cacheFirst':
      return cacheFirst(request);
    case 'staleWhileRevalidate':
      return staleWhileRevalidate(request);
    default:
      return networkFirst(request);
  }
}

async function networkFirst(request: Request): Promise<Response> {
  try {
    const response = await fetch(request);
    if (response.ok && shouldCacheApi(request.url)) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) {
      return cached;
    }
    return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function cacheFirst(request: Request): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request: Request): Promise<Response> {
  const cached = await caches.match(request);

  const fetchPromise = fetch(request).then(response => {
    if (response.ok) {
      const cache = caches.open(API_CACHE_NAME);
      cache.then(c => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => {
    return new Response(JSON.stringify({ error: 'Network error', offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  return cached || fetchPromise;
}

self.addEventListener('message', (event: MessageEvent) => {
  if (event.data === 'skipWaiting') {
    (self as unknown as ServiceWorkerGlobalScope).skipWaiting();
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
    const urls: string[] = event.data.urls || [];
    event.waitUntil(
      caches.open(API_CACHE_NAME).then(cache => {
        return Promise.all(
          urls.map(url =>
            fetch(url)
              .then(response => {
                if (response.ok) {
                  cache.put(url, response);
                }
              })
              .catch(() => {})
          )
        );
      })
    );
  }
});

export {};
