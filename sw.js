// Gitgather service worker: offline app shell, network-first for data.
const CACHE = 'gitgather-v1';
const SHELL = ['./', 'index.html', 'post.html', 'chat.html', 'profile.html', 'assets/style.css', 'assets/app.js', 'assets/logo.svg',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // never touch giscus / GitHub API
  const isData = url.pathname.includes('/data/');
  // network-first everywhere (fresh when online, cached when offline)
  if (true) {
    e.respondWith(fetch(e.request).then(r => {
      const copy = r.clone(); caches.open(CACHE).then(c => c.put(isData ? url.pathname : e.request, copy)); return r;
    }).catch(() => caches.match(isData ? url.pathname : e.request, { ignoreSearch: true })));
  }
});
