
/*
 * Stocker Service Worker
 * Robust Push Notification Handler
 */

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
  const NOTIFICATION_TAG = 'stocker-price-alert';
  
  let data = {
    title: 'Stocker Alert',
    body: 'A price target has been reached.',
    ticker: 'MARKET'
  };

  if (event.data) {
    try {
      const payload = event.data.json();
      data = {
        title: payload.title || `${payload.ticker} Alert!`,
        body: payload.body || `Price target reached for ${payload.ticker}`,
        ticker: payload.ticker || 'MARKET'
      };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: self.location.origin,
      ticker: data.ticker
    },
    actions: [
      { action: 'open', title: 'View Dashboard' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === event.notification.data.url && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow('/');
      }
    })
  );
});
