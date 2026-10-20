// Network-first service worker: always try for fresh content, fall back to the
// last cached copy when offline, or when the network is too slow (pages and data
// wait NET_TIMEOUT ms before the cached copy is used). No precache list to keep in sync.
const CACHE_NAME = 'sec-pulse-v1';
// The latest pushed morning brief, read by the app's "This morning's brief" sheet. Kept across cache cleanups.
const PUSH_CACHE = 'sec-pulse-push';
const NET_TIMEOUT = 4000;

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
  const fromCache = () => caches.match(key.href).then(hit => hit || (req.mode === 'navigate'
    ? caches.match(new URL('index.html', self.registration.scope).href).then(h => h || caches.match(self.registration.scope)) : undefined));
  const net = fetch(req).then(res => {
    if (res.ok){
      const copy = res.clone(), put = caches.open(CACHE_NAME).then(c => c.put(key.href, copy));
      try{ e.waitUntil(put); }catch(err){} // throws if the cached copy already answered and the event has finished
    }
    return res;
  });
  // On a weak signal a fetch can hang for a minute; after NET_TIMEOUT serve the cached copy if there is one
  // (the network response still lands in the cache for next time).
  const slow = req.mode === 'navigate' || key.pathname.endsWith('.json');
  e.respondWith(new Promise(resolve => {
    let done = false;
    const finish = r => { if (!done && r){ done = true; resolve(r); } };
    if (slow) setTimeout(() => fromCache().then(finish), NET_TIMEOUT);
    net.then(finish, () => fromCache().then(r => finish(r || Response.error())));
  }));
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
    // navigate() can reject (e.g. a client this worker doesn't control); fall back to opening the URL.
    if (open) return open.focus().then(c => c.navigate(url)).catch(() => self.clients.openWindow(url));
    return self.clients.openWindow(url);
  }));
});
