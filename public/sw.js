
/*
 * Service Worker for Stocker
 * Optimized for Encrypted Payloads to prevent system fallback messages.
 */

self.addEventListener('push', (event) => {
  // A unique tag ensures that if multiple pushes arrive, they replace each other
  // or handle themselves professionally without browser intervention.
  const NOTIFICATION_TAG = 'stocker-price-alert';

  // Default "Safe" data if the payload is missing or empty
  let notificationData = {
    title: 'Stocker: New Price Alert',
    body: 'A price target has been reached. Tap to view details.',
    ticker: 'MARKET'
  };

  // Check if the push contains data (The "Payload")
  if (event.data) {
    try {
      // If your worker sends JSON, we parse it here
      const json = event.data.json();
      notificationData.title = json.title || `${json.ticker} Alert!`;
      notificationData.body = json.body || `Target price reached for ${json.ticker}.`;
      notificationData.ticker = json.ticker || 'MARKET';
    } catch (e) {
      // If your worker sends plain text, we use that as the body
      const text = event.data.text();
      if (text) notificationData.body = text;
    }
  }

  // CRITICAL: We show the notification IMMEDIATELY.
  // Because we are not doing a 'fetch()' here, the browser sees the notification
  // within milliseconds of the push arriving, satisfying its "Show-something-now" rule.
  const promiseChain = self.registration.showNotification(notificationData.title, {
    body: notificationData.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG,
    renotify: true,
    requireInteraction: true,
    data: { ticker: notificationData.ticker },
    actions: [
      { action: 'open', title: 'View Chart' }
    ]
  });

  event.waitUntil(promiseChain);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Logic to focus the app window or open it
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
