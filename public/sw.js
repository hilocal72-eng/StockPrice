
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
  console.log('[Service Worker] Push Received.');
  
  const NOTIFICATION_TAG = 'stocker-price-alert';
  
  // Default data if everything fails
  let title = 'Stocker Price Alert';
  let body = 'A market target you set has been reached.';
  let ticker = 'MARKET';

  if (event.data) {
    try {
      const payload = event.data.json();
      console.log('[Service Worker] Payload:', payload);
      
      title = payload.title || (payload.ticker ? `${payload.ticker} Target Hit!` : title);
      body = payload.body || (payload.ticker ? `${payload.ticker} has reached your price target.` : body);
      ticker = payload.ticker || ticker;
    } catch (e) {
      console.warn('[Service Worker] Parsing failed, using text fallback:', e);
      body = event.data.text() || body;
    }
  }

  const options = {
    body: body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: NOTIFICATION_TAG,
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      url: self.location.origin,
      ticker: ticker,
      timestamp: Date.now()
    },
    actions: [
      { action: 'open', title: 'View Chart' }
    ]
  };

  // The promise returned by showNotification must be passed to event.waitUntil
  // to prevent the browser from showing the default "background updated" notification.
  event.waitUntil(
    self.registration.showNotification(title, options)
      .then(() => console.log('[Service Worker] Notification displayed.'))
      .catch(err => console.error('[Service Worker] Notification error:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification Clicked.');
  event.notification.close();

  const urlToOpen = new URL('/', self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window is already open at our origin, focus it
      for (const client of clientList) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
