const CACHE_NAME = 'sorteador-shell-v1';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/reset-password.html',
  '/css/tokens.css',
  '/css/styles.css',
  '/js/main.js',
  '/js/api.js',
  '/js/render.js',
  '/js/dice.js',
  '/js/icons.js',
  '/js/spine.js',
  '/js/toast.js',
  '/js/confirmDialog.js',
  '/js/reset-password.js',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Network-first for the app shell (static assets never change URL in this no-build-step
// setup, so cache-first would risk serving stale JS/CSS after a deploy); falls back to the
// cache when offline. API requests are never intercepted -- they're user-scoped/dynamic data,
// not shell assets, and must always hit the network.
self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(
    fetch(request)
      .then(response => {
        const responseCopy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, responseCopy));
        return response;
      })
      .catch(() => caches.match(request).then(cached => cached || caches.match('/index.html')))
  );
});
