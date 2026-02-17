
/*
 * Stocker Service Worker - High-Performance Version
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
 * High-Speed UserID Retrieval
 * Uses CacheStorage which is significantly faster than opening IDB in a background process.
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
  console.log('[SW] Push Received');

  // STRATEGY: Show a meaningful placeholder IMMEDIATELY.
  // We use a generic but descriptive message to satisfy the browser's 
  // "User Visible" requirement instantly.
  const initialNotification = self.registration.showNotification('Stocker: Market Update', {
    body: 'One of your price targets was triggered.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG,
    vibrate: [100],
    data: { url: '/alerts' }
  });

  // Background Task: Attempt to fetch real data and update the notification
  const updateTask = async () => {
    try {
      // 1. Get ID from fast cache (nearly 0ms latency)
      const userId = await getFastUserId();
      if (!userId) return;

      // 2. Fetch specific details
      const response = await fetch(`${API_BASE_URL}/latest?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) return;

      const alert = await response.json();
      if (alert && alert.ticker) {
        // 3. Replace the placeholder with actual stock data
        // Browser swaps them seamlessly because of the 'tag'
        return self.registration.showNotification(`${alert.ticker} Hit ${alert.target_price}!`, {
          body: `Target triggered: ${alert.condition} ${alert.target_price}.`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: NOTIFICATION_TAG, 
          renotify: false, // Prevents a double-buzz
          data: { url: '/alerts' }
        });
      }
    } catch (e) {
      console.error('[SW] Background update failed', e);
    }
  };

  // Keep worker alive for both the initial show AND the update
  event.waitUntil(Promise.all([initialNotification, updateTask()]));
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
