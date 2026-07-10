const CACHE = 'proseandspine-v1';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/db.js',
  '/js/app.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.svg',
];

// Install: pre-cache app shell
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for app shell, network-first + cache fallback for fonts
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Only handle same-origin GET and Google Fonts GET requests
  if (e.request.method !== 'GET') return;

  const isSameOrigin = url.origin === self.location.origin;
  const isFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isFonts) return;

  if (isFonts) {
    // Stale-while-revalidate for Google Fonts
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const networkPromise = fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkPromise;
      })
    );
    return;
  }

  // Cache-first for same-origin assets
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      if (cached) return cached;

      try {
        const response = await fetch(e.request);
        if (response && response.status === 200 && response.type !== 'opaque') {
          cache.put(e.request, response.clone());
        }
        return response;
      } catch {
        // Offline fallback: return index.html for navigation requests
        if (e.request.mode === 'navigate') {
          return cache.match('/index.html');
        }
        return new Response('Offline', { status: 503 });
      }
    })
  );
});
