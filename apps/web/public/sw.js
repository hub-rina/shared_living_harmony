// HOOMA service worker. Safety first: this app must stay live at a fixed URL.
// - Navigations are network-first, so a fresh build's HTML is always served when
//   online; the cache only answers when the network is truly unreachable.
// - Cross-origin requests (the API) and all non-GET requests are never touched.
// - Only content-hashed static assets are cached (safe to serve stale).
// - Bumping SW_VERSION wipes every older cache on activate (kill-switch).

const SW_VERSION = 'hooma-v1';
const SHELL_CACHE = `${SW_VERSION}-shell`;
const STATIC_CACHE = `${SW_VERSION}-static`;
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(SW_VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

function cacheFirst(request) {
  return caches.match(request).then(
    (cached) =>
      cached ||
      fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
        return response;
      }),
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isHashedStatic =
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/illustrations') ||
    url.pathname === '/icon.svg';
  if (isHashedStatic) {
    event.respondWith(cacheFirst(request));
  }
});
