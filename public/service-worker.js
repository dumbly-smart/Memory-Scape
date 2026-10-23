const CACHE_NAME = 'memoryscape-pwa-v1';
const CORE_FILES = ['/capture', '/offline.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('memoryscape-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && url.pathname === '/capture') void caches.open(CACHE_NAME).then(cache => cache.put('/capture', response.clone()));
      return response;
    }).catch(async () => {
      if (url.pathname === '/capture') return (await caches.match('/capture')) ?? (await caches.match('/offline.html'));
      return (await caches.match(request)) ?? (await caches.match('/offline.html'));
    }));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(caches.match(request).then(cached => cached ?? fetch(request).then(response => {
      if (response.ok) void caches.open(CACHE_NAME).then(cache => cache.put(request, response.clone()));
      return response;
    })));
  }
});
