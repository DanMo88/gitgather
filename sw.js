// Gitgather service worker: offline app shell; network-first; never caches Supabase/GitHub API calls.
const CACHE = 'gitgather-v2';
const SHELL = ['./', 'index.html', 'post.html', 'new.html', 'profile.html', 'messages.html', 'notifications.html', 'settings.html', 'admin.html',
  'assets/style.css', 'assets/app.js', 'assets/pages.js', 'assets/logo.svg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
