// Gitgather service worker — makes the site installable and fast.
//  • HTML pages: network-first (always fresh), cached copy as offline fallback.
//  • Static assets (css/js/icons): stale-while-revalidate.
//  • Never touches Supabase (API/auth/realtime), GitHub or any other cross-origin request,
//    and never caches OAuth callback URLs (?code= / #access_token).
const VERSION = 'gitgather-v3';
const SHELL = ['./', 'index.html', 'post.html', 'new.html', 'profile.html', 'messages.html', 'notifications.html', 'settings.html', 'admin.html',
  'assets/style.css', 'assets/app.js', 'assets/pages.js', 'assets/install.js', 'assets/logo.svg',
  'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-192.png', 'assets/icons/maskable-512.png',
  'assets/icons/apple-touch-icon.png', 'assets/icons/favicon-48.png', 'manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => Promise.all(SHELL.map(u => c.add(u).catch(() => {})))));
  self.skipWaiting();
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;                 // Supabase, GitHub, fonts, CDN → straight to network
  if (url.searchParams.has('code') || url.searchParams.has('error')) return; // OAuth callback → never cache
  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(url.pathname, copy)); }
      return r;
    }).catch(async () => (await caches.match(url.pathname)) || (await caches.match(req, { ignoreSearch: true })) || caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req, { ignoreSearch: true }).then(hit => {
    const net = fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
      return r;
    }).catch(() => hit);
    return hit || net;
  }));
});
