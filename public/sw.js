
/*
 * Service Worker for Stocker
 * Handles Background Push Notifications with Robust Fallbacks
 */

const ALERT_WORKER_URL = 'https://stocker-api.hilocal72.workers.dev';

// Helper to get anon ID from IndexedDB
async function getAnonId() {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open('StockerDB', 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('settings')) {
          resolve(null);
          return;
        }
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const getReq = store.get('stkr_anon_id');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    } catch (e) {
      resolve(null);
    }
  });
}

// Fetch the most recently triggered alert for the user with a timeout
async function fetchLatestAlert(anonId) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout

  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(anonId)}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    
    if (!response.ok) return null;
    const alerts = await response.json();
    if (!Array.isArray(alerts)) return null;
    
    const triggered = alerts
      .filter(a => a.status === 'triggered')
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
      
    return triggered.length > 0 ? triggered[0] : null;
  } catch (err) {
    console.error('[SW] Fetch failed or timed out:', err);
    return null;
  }
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Event Received.');

  // The browser requires showNotification to be called. 
  // We wrap everything in a promise that is guaranteed to resolve to showNotification.
  const promiseChain = (async () => {
    let title = 'Stocker Alert';
    let body = 'One of your price targets has been reached.';
    let ticker = 'MARKET';

    try {
      // 1. Check if payload exists in the push itself (Best practice)
      if (event.data) {
        try {
          const json = event.data.json();
          title = json.title || title;
          body = json.body || body;
          ticker = json.ticker || ticker;
        } catch (e) {
          const text = event.data.text();
          if (text) body = text;
        }
      } 
      // 2. If no payload, try a quick background fetch
      else {
        const anonId = await getAnonId();
        if (anonId) {
          const latestAlert = await fetchLatestAlert(anonId);
          if (latestAlert) {
            ticker = latestAlert.ticker;
            title = `Stocker: ${ticker} Triggered`;
            const conditionText = latestAlert.condition === 'above' ? 'rose above' : 'fell below';
            body = `${ticker} has ${conditionText} your target of ${latestAlert.target_price.toFixed(2)}.`;
          }
        }
      }
    } catch (err) {
      console.error('[SW] Error processing push:', err);
      // Fall through to default title/body
    }

    const options = {
      body: body,
      icon: '/icon-192x192.png',
      badge: '/icon-512x512.png',
      vibrate: [200, 100, 200],
      tag: `stock-alert-${ticker}`, // Tag avoids duplicate notifications
      renotify: true,
      requireInteraction: true,
      data: {
        dateOfArrival: Date.now(),
        ticker: ticker
      },
      actions: [
        { action: 'open', title: 'View Chart' },
        { action: 'close', title: 'Dismiss' },
      ]
    };

    return self.registration.showNotification(title, options);
  })();

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
