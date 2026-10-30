// Lets the app open without a network: the last page you saw and its scripts are kept in the browser.
// Data calls (/api/*) always go to the network; the app itself falls back to its copy in localStorage.
const STATIC = 'pulse-static-v1';
const PAGES = 'pulse-pages-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== STATIC && k !== PAGES) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      try {
        const res = await fetch(req);
        if (res.ok && !res.redirected) (await caches.open(PAGES)).put('/', res.clone());
        return res;
      } catch {
        return (await caches.match('/')) || Response.error();
      }
    })());
    return;
  }

  // hashed build files never change, so a cached copy is always right; icons and the manifest are refreshed in the background
  if (url.pathname.startsWith('/_next/static/') || /\.(png|svg|ico|woff2?)$/.test(url.pathname) || url.pathname === '/manifest.webmanifest') {
    e.respondWith((async () => {
      const cache = await caches.open(STATIC), hit = await cache.match(req);
      const fresh = fetch(req).then(res => { if (res.ok) cache.put(req, res.clone()); return res; }).catch(() => hit);
      return hit && url.pathname.startsWith('/_next/static/') ? hit : hit || fresh;
    })());
  }
});
