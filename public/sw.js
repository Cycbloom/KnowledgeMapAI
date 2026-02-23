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

const shouldCacheApi = (url) => {
  return API_CACHE_PATTERNS.some(pattern => pattern.test(url));
};

const getCacheStrategy = (url) => {
  for (const [strategy, patterns] of Object.entries(CACHE_STRATEGIES)) {
    if (patterns.some(pattern => url.includes(pattern))) {
      return strategy;
    }
  }
  return 'networkFirst';
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => !name.includes('v1'))
          .map(name => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
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

async function handleApiRequest(request) {
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

async function networkFirst(request) {
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

async function cacheFirst(request) {
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

async function staleWhileRevalidate(request) {
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

self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') {
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
