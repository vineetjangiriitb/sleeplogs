const CACHE_NAME = 'timelogs-v4';
const STATIC_ASSETS = [
  '/css/style.css',
  '/js/app.js',
  '/js/charts.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const dest = e.request.destination;

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response('{"error":"offline"}', {
      headers: { 'Content-Type': 'application/json' }
    })));
    return;
  }

  // Network-first for HTML & manifest so renames/assets propagate quickly.
  if (dest === 'document' || url.pathname.endsWith('/manifest.json') || url.pathname === '/') {
    e.respondWith(
      fetch(e.request).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Cache-first for other static assets.
  e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request)));
});
