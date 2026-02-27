// ProspectX Service Worker — Network First
// Prevents stale JS bundle conflicts after Vercel deploys

const CACHE_NAME = 'prospectx-v2';

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

// Fetch listener disabled — SW should not intercept any requests.
// Install + activate handlers above still clear caches and claim clients.
// Re-enable with proper origin/external checks when needed.
