const OFFLINE_CACHE = 'army-offline-v1'
self.addEventListener('install', event => { event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.add('/offline.html'))) })
self.addEventListener('activate', event => { event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('army-offline-') && key !== OFFLINE_CACHE).map(key => caches.delete(key))))])) })
// Solo se almacena la pantalla estática de desconexión, nunca datos de usuarios.
self.addEventListener('fetch', event => {
  if (event.request.mode === 'navigate' && new URL(event.request.url).origin === self.location.origin) {
    event.respondWith(fetch(event.request).catch(() => caches.match('/offline.html')))
  }
})
self.addEventListener('push', event => {
  const payload = event.data?.json() ?? {}
  event.waitUntil(self.registration.showNotification('ARMY World', {
    icon: '/army-mark.svg',
    badge: '/army-mark.svg',
    body: 'Una cuenta que seguís compartió una nueva publicación.',
    tag: payload.id ?? 'army-publicacion',
    data: { url: '/?comunidad=1' },
  }))
})
self.addEventListener('notificationclick', event => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow(new URL('/?comunidad=1', self.location.origin).href))
})
