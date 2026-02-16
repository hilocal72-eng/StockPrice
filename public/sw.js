/*
 * Service Worker for Stocker
 * Robust handling to prevent "This site has been updated..." generic message
 */

const ALERT_WORKER_URL = 'https://stocker-api.hilocal72.workers.dev';

// Helper to get anon ID from IndexedDB
async function getAnonId() {
  try {
    return new Promise((resolve) => {
      const request = indexedDB.open('StockerDB', 1);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('settings')) return resolve(null);
        const tx = db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const getReq = store.get('stkr_anon_id');
        getReq.onsuccess = () => resolve(getReq.result);
        getReq.onerror = () => resolve(null);
      };
      request.onerror = () => resolve(null);
    });
  } catch (e) { return null; }
}

async function fetchLatestAlert(anonId) {
  // Very short timeout - if the API is slow, we must move on
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 1500); 

  try {
    const response = await fetch(`${ALERT_WORKER_URL}/?userId=${encodeURIComponent(anonId)}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    const alerts = await response.json();
    // Return the most recent 'triggered' alert
    return alerts.find(a => a.status === 'triggered') || null;
  } catch (err) {
    return null;
  }
}

self.addEventListener('push', (event) => {
  // Use event.waitUntil to keep the SW alive
  event.waitUntil((async () => {
    let title = 'Stock Alert Triggered';
    let body = 'One of your price targets has been reached. Tap to view.';
    let ticker = 'MARKET';

    try {
      const anonId = await getAnonId();
      if (anonId) {
        const latestAlert = await fetchLatestAlert(anonId);
        if (latestAlert) {
          ticker = latestAlert.ticker;
          title = `${ticker} Target Reached!`;
          const condition = latestAlert.condition === 'above' ? 'rose above' : 'fell below';
          body = `${ticker} has ${condition} ${latestAlert.target_price.toFixed(2)}.`;
        }
      }
    } catch (err) {
      console.error("SW Error:", err);
    }

    // ALWAYS call showNotification at the end of the async chain
    return self.registration.showNotification(title, {
      body: body,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
      tag: 'stock-alert', // Use a constant tag to overwrite the generic browser message
      data: { ticker }
    });
  })());
});
