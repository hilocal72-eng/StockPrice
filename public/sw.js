
/*
 * Stocker Service Worker
 * "Immediate Shell" Pattern to prevent "Site updated in background"
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
  console.log('[Service Worker] Push Received.');

  const processPush = async () => {
    // 1. IMMEDIATELY show a generic notification (The "Shell")
    // This satisfies the browser's requirement to show something instantly.
    await self.registration.showNotification('Stocker Alert', {
      body: 'Processing price target...',
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: NOTIFICATION_TAG, // Using a tag allows us to replace this later
      silent: true // Start quiet while we fetch details
    });

    // 2. Fetch the actual data in the background
    const userId = await getUserIdFromIDB();
    if (!userId) {
      // Fallback if ID is missing
      return self.registration.showNotification('Stocker Alert', {
        body: 'A stock price target has been hit. Open the app to view.',
        tag: NOTIFICATION_TAG,
        renotify: true
      });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/latest?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('Fetch failed');
      
      const alert = await response.json();
      if (alert.error) throw new Error(alert.error);

      // 3. REPLACE the generic notification with the real data
      // Because the TAG is the same, the browser updates the existing notification
      return self.registration.showNotification(`${alert.ticker} Target Hit!`, {
        body: `${alert.ticker} has reached your target of ${alert.target_price}.`,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: NOTIFICATION_TAG,
        renotify: true, // This makes it buzz/sound once we have real data
        vibrate: [200, 100, 200],
        data: {
          url: self.location.origin,
          ticker: alert.ticker
        },
        actions: [{ action: 'open', title: 'View Chart' }]
      });
    } catch (e) {
      console.error('[Service Worker] Fetch failed, keeping generic:', e);
      // We don't need to do anything else; the generic notification from step 1 is already visible.
    }
  };

  event.waitUntil(processPush());
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
