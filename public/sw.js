const CACHE = 'decifra-v4'
const STATIC = ['/', '/app', '/manifest.json', '/icons/favicon.svg', '/og-image.png']

// API routes to cache for offline use (NetworkFirst with fallback)
const API_CACHE = 'decifra-api-v1'
const CACHEABLE_API = ['/api/user/me', '/api/simulado/start', '/api/ranking']

self.addEventListener('install', e => {
  self.skipWaiting()
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC).catch(() => {})))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== API_CACHE).map(k => caches.delete(k)))
  ))
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // API: NetworkFirst — serve from cache if offline
  if (url.pathname.startsWith('/api/')) {
    const isCacheable = CACHEABLE_API.some(p => url.pathname.startsWith(p)) && e.request.method === 'GET'
    if (!isCacheable) return
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) caches.open(API_CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }).catch(async () => {
        const cached = await caches.match(e.request, { cacheName: API_CACHE })
        return cached || new Response(JSON.stringify({ error: 'Offline — sem conexão' }), { status: 503, headers: { 'Content-Type': 'application/json' } })
      })
    )
    return
  }

  if (url.origin !== self.location.origin) return

  // Static assets: StaleWhileRevalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok && res.status < 400) caches.open(CACHE).then(c => c.put(e.request, res.clone()))
        return res
      }).catch(() => cached || new Response('Offline', { status: 503 }))
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
