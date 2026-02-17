
/*
 * Stocker Service Worker - Direct Payload Version
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

/**
 * PUSH HANDLER (Direct Payload)
 */
self.addEventListener('push', (event) => {
  let data = {
    title: 'Stocker: Alert',
    body: 'A price target was reached.',
    url: '/alerts'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('Push data was not JSON, falling back to text.');
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    tag: 'stocker-price-hit',
    vibrate: [100],
    data: { url: data.url || '/alerts' },
    // renotify: true ensures multiple hits for different stocks show up
    renotify: true 
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('push', (event) => {
  let notificationData = {
    title: 'Stocker Update',
    body: 'A price alert was triggered.',
    icon: '/icon-192x192.png'
  };

  // NEW LOGIC: Just read the data sent from the worker
  if (event.data) {
    try {
      notificationData = event.data.json(); 
    } catch (e) {
      console.warn("Push event data was not valid JSON");
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});
