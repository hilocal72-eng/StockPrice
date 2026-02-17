
/*
 * Stocker Service Worker - Final Compliance Version
 */

const API_BASE_URL = 'https://stocker-api.hilocal72.workers.dev';
const NOTIFICATION_TAG = 'stocker-price-hit';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

/**
 * Fast ID Lookup
 */
async function getFastUserId() {
  try {
    const cache = await caches.open('stocker-fast-id');
    const response = await cache.match('/user-id');
    if (response) return await response.text();
  } catch (e) {}
  return null;
}

/**
 * PUSH HANDLER
 */
self.addEventListener('push', (event) => {
  // 1. SHOW THE NOTIFICATION IMMEDIATELY
  // We do not 'await' anything before this call. 
  // This satisfies the browser's watchdog instantly.
  const promise = self.registration.showNotification('Stocker: Price Alert', {
    body: 'A stock has reached your target price.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG,
    vibrate: [100],
    data: { url: '/alerts' }
  }).then(async () => {
    // 2. NOW (In the background) try to get real data to update the text.
    try {
      const userId = await getFastUserId();
      if (!userId) return;

      const response = await fetch(`${API_BASE_URL}/latest?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) return;

      const alert = await response.json();
      if (alert && alert.ticker) {
        // 3. Update the existing notification with real data
        return self.registration.showNotification(`${alert.ticker} Hit ${alert.target_price}!`, {
          body: `Target reached: ${alert.condition} ${alert.target_price}.`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: NOTIFICATION_TAG, 
          renotify: false, 
          data: { url: '/alerts' }
        });
      }
    } catch (e) {
      console.error('[SW] Data fetch failed, generic notification remains.');
    }
  });

  event.waitUntil(promise);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow('/');
    })
  );
});
