// firebase-messaging-sw.js
// This service worker handles Firebase Cloud Messaging background push notifications.
// It MUST be at the root /public directory so it's served from the origin root.

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBlO56RbFAs9CqE1OMRwITCyJEpzi3B0iQ",
  authDomain: "smarttable-1e214.firebaseapp.com",
  projectId: "smarttable-1e214",
  storageBucket: "smarttable-1e214.firebasestorage.app",
  messagingSenderId: "436851130285",
  appId: "1:436851130285:web:ff2384ce040948a9f8eb24",
});

const messaging = firebase.messaging();

// Handle background messages (when app is not in foreground)
messaging.onBackgroundMessage((payload) => {
  console.log('[SmartTable SW] Background push received:', payload);

  const { title, body } = payload.notification || {};
  const link = payload.data?.link || '/dashboard/orders';

  const notificationOptions = {
    body: body || 'New notification',
    icon: '/pwa-192x192.png',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    requireInteraction: false,
    tag: 'smarttable-notification',
    renotify: true,
    data: { url: link },
  };

  self.registration.showNotification(title || 'SmartTable', notificationOptions);
});

// Handle notification click — open/focus the correct page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL(
    event.notification.data?.url || '/dashboard/orders',
    self.location.origin
  ).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url.includes('/dashboard'));
      if (existing && 'focus' in existing) {
        return existing.focus().then((c) => c.navigate(urlToOpen));
      }
      return clients.openWindow(urlToOpen);
    })
  );
});
