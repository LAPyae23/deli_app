// FoodDash service worker — shows Web Push notifications.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'FoodDash', body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'FoodDash', {
      body: data.body || '',
      tag: data.tag,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if (w.url.includes(url) && 'focus' in w) return w.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
