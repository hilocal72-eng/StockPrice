
/*
 * Stocker Service Worker - FINAL STABLE VERSION
 */

const API_BASE_URL = 'https://stocker-api.hilocal72.workers.dev';
const NOTIFICATION_TAG = 'stocker-alert-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

/**
 * Robust IDB Getter
 */
async function getUserId() {
  return new Promise((resolve) => {
    const request = indexedDB.open('StockerDB', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) return resolve(null);
      const tx = db.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const getReq = store.get('stkr_anon_id');
      getReq.onsuccess = () => resolve(getReq.result);
      getReq.onerror = () => resolve(null);
    };
  });
}

/**
 * PUSH EVENT HANDLER
 */
self.addEventListener('push', (event) => {
  console.log('[SW] Push Received');

  // 1. SHOW GENERIC NOTIFICATION IMMEDIATELY
  // This is the "Guarantee". We do not await anything before this.
  const promise = self.registration.showNotification('Stocker: Price Target Hit', {
    body: 'One of your monitored stocks reached its target. Tap to view.',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG, // Critical for replacement
    vibrate: [100],
    data: { url: '/' }
  }).then(async () => {
    // 2. NOW TRY TO GET SPECIFIC DATA
    try {
      const userId = await getUserId();
      if (!userId) return;

      const response = await fetch(`${API_BASE_URL}/latest?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) return;

      const alert = await response.json();
      if (alert && alert.ticker) {
        // 3. REPLACE THE GENERIC NOTIFICATION WITH REAL DATA
        // Because we use the same TAG, the browser just swaps the text.
        return self.registration.showNotification(`${alert.ticker} Hit ${alert.target_price}!`, {
          body: `Target triggered: ${alert.condition} ${alert.target_price}.`,
          icon: '/icon-192x192.png',
          badge: '/icon-192x192.png',
          tag: NOTIFICATION_TAG, // Same tag = Replace
          renotify: false, // Don't buzz twice, just update the text
          data: { url: '/' }
        });
      }
    } catch (e) {
      console.error('[SW] Data fetch failed, keeping generic notification.');
    }
  });

  // Keep the worker alive until the chain is complete
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
