const CACHE = 'decifra-v1'
const STATIC = ['/', '/app', '/src/style.css', '/src/main.js', '/manifest.json', '/icons/favicon.svg']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return

  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }).catch(() => cached)
      return cached || network
    })
  )
})

self.addEventListener('message', e => {
  if (e.data?.type === 'NOTIFY') {
    self.registration.showNotification(e.data.title, {
      body: e.data.body,
      icon: '/icons/favicon.svg',
      tag: 'decifra-daily',
      renotify: false,
    })
  }
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    const existing = list.find(w => w.url.includes('/app'))
    if (existing) return existing.focus()
    return clients.openWindow('/app')
  }))
})
