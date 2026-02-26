// ProspectX Service Worker — Network First
// Prevents stale JS bundle conflicts after Vercel deploys

const CACHE_NAME = 'prospectx-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Never cache API calls — always network
  if (e.request.url.includes('/api/') ||
       e.request.url.includes('railway.app')) {
    e.respondWith(fetch(e.request));
    return;
  }
  // Network first for everything else
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
