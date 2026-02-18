/*
 * Stocker Service Worker - Push Handler
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

/**
 * PUSH EVENT HANDLER
 */
self.addEventListener('push', (event) => {
  let data = {
    title: 'Target Hit!',
    body: 'A stock price alert was triggered.',
    url: '/alerts'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'stock-alert',
    vibrate: [200, 100, 200],
    data: { url: data.url || '/alerts' },
    renotify: true,
    requireInteraction: true // Keeps notification visible until user acts
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
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