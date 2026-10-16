// Network-first service worker: always try for fresh content, fall back to the
// last cached copy when offline. No precache list to keep in sync.
const CACHE_NAME = 'sec-pulse-v1';
// The latest pushed morning brief, read by the app's "This morning's brief" sheet. Kept across cache cleanups.
const PUSH_CACHE = 'sec-pulse-push';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME && k !== PUSH_CACHE).map(k => caches.delete(k))))
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

// Web Push (the morning brief and weekly digest, sent by send_brief.py). Payload: {title, body, url, tag, brief?}.
// On iOS this only works for the Home Screen app, and tapping the notification opens that app.
self.addEventListener('push', e => {
  let d = {};
  try{ d = e.data ? e.data.json() : {}; }catch(err){ d = {body: e.data ? e.data.text() : ''}; }
  const saveBrief = d.brief ? caches.open(PUSH_CACHE).then(c => c.put('push-brief.json',
    new Response(JSON.stringify(d.brief), {headers: {'Content-Type': 'application/json'}}))).catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([saveBrief, self.registration.showNotification(d.title || 'Sec-Pulse', {
    body: d.body || '', tag: d.tag || 'sec-pulse', icon: 'assets/icons/icon-192.png?v=1', badge: 'assets/icons/icon-192.png?v=1',
    data: {url: new URL(d.url || './#brief', self.registration.scope).href}
  })]));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || self.registration.scope;
  e.waitUntil(self.clients.matchAll({type: 'window', includeUncontrolled: true}).then(list => {
    const open = list.find(c => c.url.startsWith(self.registration.scope));
    if (open) return open.focus().then(c => c.navigate(url)).catch(() => {});
    return self.clients.openWindow(url);
  }));
});
