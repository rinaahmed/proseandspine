const CACHE = 'proseandspine-v33.5';

const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/db.js',
  '/js/app.js',
  '/js/books-api.js',
  '/js/goodreads.js',
  '/manifest.json',
  '/icons/icon.svg',
  '/icons/apple-touch-icon.svg',
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(APP_SHELL))
  );
  // Take over immediately — don't wait for old tabs to close
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    // Delete every cache that isn't the current version
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  // Claim all open tabs immediately so they get the new SW right away
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;

  const url = new URL(e.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isFonts = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';

  if (!isSameOrigin && !isFonts) return;

  if (isFonts) {
    // Stale-while-revalidate for Google Fonts
    e.respondWith(
      caches.open(CACHE).then(async cache => {
        const cached = await cache.match(e.request);
        const networkFetch = fetch(e.request).then(res => {
          if (res && res.status === 200) cache.put(e.request, res.clone());
          return res;
        }).catch(() => null);
        return cached || networkFetch;
      })
    );
    return;
  }

  // Network-first for same-origin: always try to get fresh files,
  // fall back to cache only when offline
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res && res.status === 200 && res.type !== 'opaque') {
          caches.open(CACHE).then(cache => cache.put(e.request, res.clone()));
        }
        return res;
      })
      .catch(() =>
        caches.match(e.request).then(cached =>
          cached || (e.request.mode === 'navigate'
            ? caches.match('/index.html')
            : new Response('Offline', { status: 503 }))
        )
      )
  );
});
