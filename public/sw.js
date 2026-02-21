/*
 * Stocker Service Worker - Push Handler
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

/**
 * PUSH EVENT HANDLER
 */
self.addEventListener('push', (event) => {
  let title = 'Target Hit!';
  let body = 'A stock price alert was triggered.';
  let url = '/alerts';

  if (event.data) {
    try {
      const text = event.data.text();
      if (text) {
        try {
          const json = JSON.parse(text);
          title = json.title || title;
          body = json.body || body;
          url = json.url || url;
        } catch (e) {
          body = text;
        }
      }
    } catch (e) {
      console.error('Error parsing push data', e);
    }
  }

  const options = {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'stock-alert-' + Date.now(),
    data: { url: url },
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(urlToOpen);
    })
  );
});