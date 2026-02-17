
/*
 * Stocker Service Worker - Bulletproof Version
 */

const API_BASE_URL = 'https://stocker-api.hilocal72.workers.dev';
const NOTIFICATION_TAG = 'stocker-price-alert';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

/**
 * Helper to get UserID from IndexedDB
 */
async function getUserIdFromIDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('StockerDB', 1);
    request.onerror = () => resolve(null);
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains('settings')) {
        resolve(null);
        return;
      }
      try {
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const getReq = store.get('stkr_anon_id');
        getReq.onsuccess = () => resolve(getReq.result || null);
        getReq.onerror = () => resolve(null);
      } catch (e) {
        resolve(null);
      }
    };
  });
}

/**
 * Main Push Handler
 */
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push event received');

  // STRATEGY: 
  // We must show a notification IMMEDIATELY. 
  // We do NOT await anything before showing the first one.
  const initialNotificationPromise = self.registration.showNotification('Stocker Alert', {
    body: 'Checking latest price targets...',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG,
    // Note: Removed 'silent: true' because some browsers require sound/vibration 
    // to count it as a valid user-visible notification.
  });

  const updateNotificationPromise = async () => {
    // Wait for the first notification to at least be "sent" to the system
    await initialNotificationPromise;

    const userId = await getUserIdFromIDB();
    if (!userId) return;

    try {
      // Fetch the actual triggered alert from the worker
      const response = await fetch(`${API_BASE_URL}/latest?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Network response was not ok');
      
      const alert = await response.json();
      if (alert.error) throw new Error(alert.error);

      // Replace the "Checking..." notification with real data
      // We use the same 'tag' so it replaces the existing one silently or with a single buzz
      await self.registration.showNotification(`${alert.ticker} Target Hit!`, {
        body: `${alert.ticker} reached ${alert.target_price}. View details in app.`,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: NOTIFICATION_TAG,
        renotify: true, // Allow a second buzz for the real data
        vibrate: [100, 50, 100],
        data: { url: '/' }
      });
    } catch (e) {
      console.error('[Service Worker] Background fetch failed:', e);
      // We don't need to do anything; the "Checking..." notification is already there.
    }
  };

  // event.waitUntil keeps the service worker alive until both are done
  event.waitUntil(Promise.all([initialNotificationPromise, updateNotificationPromise()]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
