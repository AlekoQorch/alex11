/* Cold Caller — network-first updates (never return null from respondWith) */
const CACHE = 'cold-caller-v211';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function isFreshNeeded(url) {
  const p = url.pathname;
  return (
    p.endsWith('/') ||
    p.endsWith('.html') ||
    p.endsWith('version.json') ||
    p.endsWith('manifest.json') ||
    p.endsWith('manifest-verify.json') ||
    p.endsWith('sw.js')
  );
}

function offlineFallback(req) {
  return caches.match(req).then((cached) => {
    if (cached) return cached;
    return new Response('Offline', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  });
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  let url;
  try {
    url = new URL(req.url);
  } catch (_) {
    return;
  }
  if (url.origin !== self.location.origin) return;

  if (req.mode === 'navigate' || isFreshNeeded(url)) {
    event.respondWith(
      fetch(req, { cache: 'no-store' })
        .then((res) => res || offlineFallback(req))
        .catch(() => offlineFallback(req))
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res || offlineFallback(req);
      })
      .catch(() => offlineFallback(req))
  );
});
