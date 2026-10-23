const CACHE_NAME = 'memoryscape-pwa-v2';
const CORE_FILES = ['/capture', '/offline.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('memoryscape-pwa-') && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('push', event => {
  let payload = { title: 'MemoryScape', body: 'You have something to review.', url: '/daily', tag: 'memoryscape-reminder' };
  try { if (event.data) payload = { ...payload, ...event.data.json() }; } catch { /* Use the safe generic notification for malformed payloads. */ }
  const url = typeof payload.url === 'string' && payload.url.startsWith('/') ? payload.url : '/daily';
  event.waitUntil(self.registration.showNotification(String(payload.title).slice(0, 120), {
    body: String(payload.body).slice(0, 240),
    tag: String(payload.tag ?? 'memoryscape-reminder').slice(0, 128),
    data: { url },
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? '/daily', self.location.origin);
  const safeUrl = target.origin === self.location.origin ? target.href : new URL('/daily', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    const existing = clients.find(client => client.url.startsWith(self.location.origin));
    return existing && 'focus' in existing ? existing.navigate(safeUrl).then(() => existing.focus()) : self.clients.openWindow(safeUrl);
  }));
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
