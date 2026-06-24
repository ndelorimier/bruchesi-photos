/* global self, clients */
// Gestionnaires de notifications push — importé par le service worker Workbox
// généré (voir workbox.importScripts dans vite.config.js).

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = {}; }
  const title = data.title || 'Bruchési Photos';
  const options = {
    body: data.body || 'Une nouvelle photo est disponible.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.photoId ? ('photo-' + data.photoId) : 'bruchesi-photo',
    data: { url: '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) { w.navigate && w.navigate(url); return w.focus(); }
      }
      return self.clients.openWindow ? self.clients.openWindow(url) : undefined;
    })
  );
});
