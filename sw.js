// School grades service worker: the app opens without internet; data sync is done by the page.
const CACHE = 'school-grades-2026.10.07-1210';
const SHELL = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== 'dah-fonts').map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return;
  if (url.origin === location.origin) {
    // the published version number: always from the internet (Settings → Update compares it)
    if (url.pathname.endsWith('/version.json')) {
      e.respondWith(fetch(req.url, { cache: 'no-store' }).catch(() => new Response('{}', { headers: { 'Content-Type': 'application/json' } })));
      return;
    }
    // the program page: newest version when online, the saved copy offline or if the network is slow (4 s)
    if (req.mode === 'navigate') {
      e.respondWith(caches.open(CACHE).then(async c => {
        const hit = await c.match('./index.html');
        const net = fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(r => { if (r.ok) c.put('./index.html', r.clone()); return r; });
        if (!hit) return net;
        return Promise.race([net.catch(() => hit), new Promise(res => setTimeout(() => res(hit), 4000))]);
      }));
      return;
    }
    // other files (icons, manifest): stale-while-revalidate
    const key = req;
    e.respondWith(caches.open(CACHE).then(async c => {
      const hit = await c.match(key, { ignoreSearch: true });
      const net = fetch(req).then(r => { if (r.ok) c.put(key, r.clone()); return r; }).catch(() => hit);
      return hit || net;
    }));
  } else if (url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com') {
    e.respondWith(caches.open('dah-fonts').then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      try { const r = await fetch(req); c.put(req, r.clone()); return r; } catch (err) { return Response.error(); }
    }));
  }
});
