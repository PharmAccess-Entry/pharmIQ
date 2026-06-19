// SmartTable Service Worker — handles push notifications + offline caching + update detection

const CACHE_NAME = 'smarttable-v2';
const STATIC_ASSETS = ['/', '/dashboard', '/manifest.webmanifest'];

// ─── Install: pre-cache critical shell assets ───────────────────────────────
self.addEventListener('install', (event) => {
  // Skip waiting so new SW activates immediately
  self.skipWaiting();
});

// ─── Activate: clean up old caches ──────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// ─── Fetch: network-first for API, cache-first for static ───────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin requests
  if (request.method !== 'GET') return;
  if (url.origin !== self.location.origin) return;

  // Always hit network for supabase/API calls
  if (url.pathname.startsWith('/rest/') || url.pathname.startsWith('/auth/') || url.pathname.includes('supabase')) return;

  // Network-first strategy
  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful same-origin GET responses
        if (response && response.status === 200 && response.type === 'basic') {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// ─── Push: receive push notification and show it ────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'SmartTable', body: event.data.text() };
  }

  const { title = 'SmartTable', body = 'New notification', link = '/dashboard/orders', icon, badge } = data;

  const options = {
    body,
    icon: icon || '/pwa-192x192.png',
    badge: badge || '/favicon.svg',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: 'smarttable-notification',
    renotify: true,
    data: { url: link },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Notification click: open/focus the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(event.notification.data?.url || '/dashboard/orders', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Focus existing dashboard window if open
      const existing = windowClients.find((c) => c.url.includes('/dashboard'));
      if (existing && 'focus' in existing) {
        return existing.focus().then((c) => c.navigate(urlToOpen));
      }
      return clients.openWindow(urlToOpen);
    })
  );
});

// ─── Message: handle skipWaiting from app ────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
