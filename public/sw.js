
/*
 * Service Worker for Stocker
 * Handles Background Push Notifications (Tickle Method)
 */

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  
  let data = { 
    title: 'Stocker Market Alert', 
    body: 'One of your price targets has been reached. Tap to view details.' 
  };
  
  // Try to parse data if it exists (for future encrypted payloads)
  if (event.data) {
    try {
      const json = event.data.json();
      data.title = json.title || data.title;
      data.body = json.body || data.body;
      data.ticker = json.ticker;
      console.log('[Service Worker] Payload detected:', json);
    } catch (e) {
      const text = event.data.text();
      if (text) data.body = text;
      console.log('[Service Worker] Text payload detected:', text);
    }
  } else {
    console.log('[Service Worker] Tickle received (no payload). Showing generic alert.');
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-512x512.png',
    vibrate: [200, 100, 200],
    tag: data.ticker ? `stock-alert-${data.ticker}` : 'stock-alert-generic',
    renotify: true,
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      { action: 'open', title: 'Open Dashboard' },
      { action: 'close', title: 'Dismiss' },
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .catch(err => console.error('[Service Worker] Notification Error:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing window if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Or open a new one
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
