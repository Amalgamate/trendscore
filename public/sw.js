/**
 * TreadSCORE Service Worker
 *
 * Strategy:
 *  - App shell (HTML, JS, CSS chunks): Cache-first with network fallback
 *  - API calls (/api/*): Network-first with offline fallback response
 *  - Static assets (images, fonts): Stale-while-revalidate
 *  - Socket.IO: Always bypass (WebSocket, cannot cache)
 *
 * Cache names are versioned so old caches are automatically purged on SW update.
 */

try {
  importScripts('/sw-version.js');
} catch {
  self.__TS_SW_VERSION__ = 'dev';
}

const CACHE_VERSION = self.__TS_SW_VERSION__ || 'dev';
const SHELL_CACHE = `ts-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `ts-assets-${CACHE_VERSION}`;
const API_CACHE  = `ts-api-${CACHE_VERSION}`;

// App shell files to pre-cache on install
const SHELL_URLS = [
  '/',
  '/index.html',
];

// ── Install ───────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) =>
      cache.addAll(SHELL_URLS).catch(() => {
        // Non-fatal: offline-first shell cache is best-effort on first install
      })
    ).then(() => self.skipWaiting())
  );
});

// ── Activate ──────────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith('ts-') && ![SHELL_CACHE, ASSET_CACHE, API_CACHE].includes(k))
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch ─────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Always bypass socket.io, chrome-extension, and non-GET
  if (
    request.method !== 'GET' ||
    url.pathname.startsWith('/socket.io') ||
    url.protocol === 'chrome-extension:'
  ) {
    return;
  }

  // API calls — network-first, offline JSON fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstApi(request));
    return;
  }

  // JS/CSS chunks (hashed filenames) — cache-first
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(request));
    return;
  }

  // HTML navigation — serve shell from cache, fallback to network
  if (request.mode === 'navigate') {
    event.respondWith(shellFirst(request));
    return;
  }
});

// ── Strategies ────────────────────────────────────────────────────────────────

async function networkFirstApi(request) {
  const cache = await caches.open(API_CACHE);
  try {
    const response = await fetch(request.clone());
    // Only cache successful GET responses
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    // Return a structured offline fallback for API calls
    return new Response(
      JSON.stringify({ success: false, offline: true, message: 'You are offline. This data may be stale.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirstAsset(request) {
  const cache = await caches.open(ASSET_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch {
    return new Response('Asset unavailable offline', { status: 503 });
  }
}

async function shellFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match('/index.html') || await cache.match('/');
  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(request, response.clone()).catch(() => {});
    }
    return response;
  } catch {
    return cached || new Response('<h1>Offline</h1><p>TreadSCORE is not available offline yet. Please reconnect.</p>', {
      status: 503,
      headers: { 'Content-Type': 'text/html' },
    });
  }
}

// ── Push Notifications ────────────────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  let data = {};
  try { data = event.data.json(); } catch { data = { title: 'TreadSCORE', body: event.data.text() }; }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TreadSCORE', {
      body: data.body || '',
      icon: '/branding/logo.png',
      badge: '/branding/favicon.png',
      tag: data.tag || 'trendscore-notification',
      data: { url: data.url || '/' },
      requireInteraction: false,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'navigate', url: targetUrl });
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
