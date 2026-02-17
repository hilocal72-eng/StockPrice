
/*
 * Stocker Service Worker
 * Robust Poke-and-Fetch Notification Handler
 */

const API_BASE_URL = 'https://stocker-api.hilocal72.workers.dev';

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

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received (Poke).');
  
  const NOTIFICATION_TAG = 'stocker-price-alert';
  
  // Logic: 
  // 1. Get userId from IndexedDB
  // 2. Fetch latest triggered alert from API
  // 3. Show notification
  const notificationPromise = (async () => {
    const userId = await getUserIdFromIDB();
    
    if (!userId) {
      console.warn('[Service Worker] No UserID found in IndexedDB.');
      return self.registration.showNotification('Stocker Alert', {
        body: 'A price target has been hit. Open the app to check your alerts.',
        tag: NOTIFICATION_TAG
      });
    }

    try {
      const response = await fetch(`${API_BASE_URL}/latest?userId=${encodeURIComponent(userId)}`);
      if (!response.ok) throw new Error('API Fetch failed');
      
      const alert = await response.json();
      if (alert.error) throw new Error(alert.error);

      return self.registration.showNotification(`${alert.ticker} Target Hit!`, {
        body: `${alert.ticker} has reached your target of ${alert.target_price}.`,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: NOTIFICATION_TAG,
        renotify: true,
        vibrate: [200, 100, 200],
        data: {
          url: self.location.origin,
          ticker: alert.ticker
        },
        actions: [{ action: 'open', title: 'View Chart' }]
      });
    } catch (e) {
      console.error('[Service Worker] Fetch failed, showing fallback:', e);
      return self.registration.showNotification('Stocker Price Alert', {
        body: 'One of your monitored stocks hit a target price!',
        tag: NOTIFICATION_TAG
      });
    }
  })();

  event.waitUntil(notificationPromise);
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification Clicked.');
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
