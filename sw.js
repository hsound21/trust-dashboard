// 앱 셸은 캐시 우선, 데이터(JSON)는 네트워크 우선(실패 시 캐시)
const VERSION = 'v2';
const SHELL = [
  './', 'index.html', 'manifest.webmanifest',
  'css/base.css', 'css/app.css',
  'js/main.js', 'js/charts.js', 'js/format.js', 'js/theme.js',
  'icons/icon.svg', 'icons/icon-192.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== location.origin) return;
  const isData = e.request.url.includes('/data/');
  e.respondWith(isData ? networkFirst(e.request) : staleWhileRevalidate(e.request));
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    cache.put(req, res.clone());
    return res;
  } catch (err) {
    return (await cache.match(req)) ?? Response.error();
  }
}

async function staleWhileRevalidate(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const fresh = fetch(req).then((res) => { cache.put(req, res.clone()); return res; }).catch(() => hit);
  return hit ?? fresh;
}
