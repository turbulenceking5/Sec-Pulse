// Network-first service worker: always try for fresh content, fall back to the
// last cached copy when offline. No precache list to keep in sync.
const CACHE_NAME = 'sec-pulse-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // Cache key ignores the ?_= cache-buster so offline lookups still hit.
  const key = new URL(req.url); key.searchParams.delete('_');
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE_NAME).then(c => c.put(key.href, copy)); }
      return res;
    }).catch(() => caches.match(key.href).then(hit => hit || caches.match('index.html')))
  );
});
