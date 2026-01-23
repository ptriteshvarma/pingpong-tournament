// Service Worker for Ping Pong Tournament Push Notifications
const CACHE_NAME = 'pingpong-v2';

// Install event - force update by skipping waiting
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing v2...');
  self.skipWaiting(); // Activate immediately
});

// Activate event - clear old caches
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activated v2');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// Push event - receives push notifications even when app is closed
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push received');

  let data = {
    title: 'Ping Pong League',
    body: 'New update available!',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'pingpong-notification',
    data: { url: '/' }
  };

  try {
    if (event.data) {
      const payload = event.data.json();
      data = {
        title: payload.title || data.title,
        body: payload.body || data.body,
        icon: payload.icon || data.icon,
        badge: payload.badge || data.badge,
        tag: payload.tag || data.tag,
        data: payload.data || data.data
      };
    }
  } catch (e) {
    console.error('[Service Worker] Error parsing push data:', e);
  }

  const options = {
    body: data.body,
    icon: data.icon,
    badge: data.badge,
    tag: data.tag,
    data: data.data,
    requireInteraction: false,
    vibrate: [200, 100, 200]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked');
  event.notification.close();

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        // Check if there's already a window open
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if none found
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

// Background sync for offline actions (future use)
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sync event:', event.tag);
});
