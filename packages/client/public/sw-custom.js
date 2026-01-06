// Custom service worker additions for push notifications
// This will be merged with the Workbox service worker by vite-plugin-pwa

self.addEventListener('push', (event) => {
  console.log('[SW] Push event triggered!');
  const data = event.data?.json() ?? {};

  console.log('[SW] Push data:', data);
  console.log('[SW] Showing notification with title:', data.title);

  event.waitUntil(
    self.registration.showNotification(data.title || 'Benachrichtigung', {
      body: data.body,
      icon: '/icon-192.svg',
      badge: '/icon-192.svg',
      data: data.data,
      tag: data.data?.todoId ? `todo-${data.data.todoId}` : undefined,
      requireInteraction: false,
    }).then(() => {
      console.log('[SW] Notification shown successfully');
    }).catch((err) => {
      console.error('[SW] Failed to show notification:', err);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { workspaceId } = event.notification.data || {};
  const url = workspaceId ? `/workspace/${workspaceId}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
