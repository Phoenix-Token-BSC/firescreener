importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');

// Handle notificationclick for locally-shown notifications (shown via
// ServiceWorkerRegistration.showNotification in the price-alert hook).
// OneSignal's SDK handles clicks on push notifications it delivers;
// this listener catches the ones the client shows directly while on-page.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url;
  if (!url) return;
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url === url && 'focus' in client) return client.focus();
        }
        return clients.openWindow(url);
      }),
  );
});
