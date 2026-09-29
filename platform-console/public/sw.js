'use strict';

// Trends CORE ERP — minimal PWA shell caching.
// Deliberately NOT cached: index.html (the login/app shell — always network,
// so a stale cached page can never show the wrong session state after a
// user switches accounts on this device) and anything under /api/ (every
// API response here can be session- or account-specific).

const SHELL_CACHE = 'tc-console-shell-v2';
const SHELL_ASSETS = [
  './styles.css',
  './login.css',
  './kanban-crm.css',
  './app.js',
  './login.js',
  './manifest.json',
  './icon.svg',
  './favicon-32x32.png',
  './favicon-16x16.png',
  './apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== SHELL_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // let CDN/font requests pass through untouched

  // Never intercept navigations (index.html) or API calls — always hit the network.
  if (request.mode === 'navigate' || url.pathname.startsWith('/api/')) return;

  const isShellAsset = SHELL_ASSETS.some(asset => url.pathname.endsWith('/' + asset.replace('./', '')));
  if (!isShellAsset) return; // not a known shell asset — let the network handle it normally

  event.respondWith(
    fetch(request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(SHELL_CACHE).then(cache => cache.put(request, copy));
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      return new Response('This console asset is unavailable offline.', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    })
  );
});
