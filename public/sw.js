/*
 * Service Worker for Stocker
 * Handles Background Push Notifications (Tickle Method)
 */

// Force the service worker to become active immediately
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating and claiming clients...');
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Event Received.');
  
  let data = { 
    title: 'Stocker Alert', 
    body: 'One of your price targets has been reached.' 
  };
  
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
    console.log('[Service Worker] Empty (Tickle) push received.');
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-512x512.png',
    vibrate: [200, 100, 200],
    tag: data.ticker ? `stock-alert-${data.ticker}` : 'stock-alert-generic',
    renotify: true,
    requireInteraction: true,
    data: {
      dateOfArrival: Date.now(),
      ticker: data.ticker
    },
    actions: [
      { action: 'open', title: 'View Chart' },
      { action: 'close', title: 'Dismiss' },
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
      .then(() => console.log('[Service Worker] Notification shown successfully.'))
      .catch(err => console.error('[Service Worker] Notification display failed:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked:', event.action);
  event.notification.close();

  if (event.action === 'close') return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (self.clients.openWindow) {
        return self.clients.openWindow('/');
      }
    })
  );
});
