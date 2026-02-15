
/*
 * Service Worker for Stocker
 * Handles Background Push Notifications
 */

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  
  let data = { title: 'Stocker Alert', body: 'Price target breach detected.' };
  
  if (event.data) {
    try {
      data = event.data.json();
      console.log('[Service Worker] Push Data (JSON):', data);
    } catch (e) {
      data.body = event.data.text();
      console.log('[Service Worker] Push Data (Text):', data.body);
    }
  } else {
    console.log('[Service Worker] Push event received but no data payload found.');
  }

  const options = {
    body: data.body || 'Price target breach detected.',
    icon: '/icon-192x192.png',
    badge: '/icon-512x512.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: '1'
    },
    actions: [
      { action: 'open', title: 'View Chart' },
      { action: 'close', title: 'Dismiss' },
    ],
    // Tag prevents multiple notifications for the same stock from stacking up
    tag: 'stock-alert-' + (data.ticker || 'generic'),
    renotify: true
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'Stocker Alert', options)
      .then(() => console.log('[Service Worker] Notification displayed successfully.'))
      .catch(err => console.error('[Service Worker] Error displaying notification:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification clicked. Action:', event.action);
  event.notification.close();

  if (event.action === 'close') {
    return;
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) {
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
