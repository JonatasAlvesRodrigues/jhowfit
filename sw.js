const VERSION = '2026.08.06.3'
const STATIC_CACHE = `movelya-static-${VERSION}`

self.addEventListener('install', (event) => {
  const scope = self.registration.scope
  const shell = [
    new URL('./', scope).toString(),
    new URL('./index.html', scope).toString(),
    new URL('./offline.html', scope).toString(),
    new URL('./manifest.webmanifest', scope).toString(),
    new URL('./icon-192.png', scope).toString(),
    new URL('./icon-512.png', scope).toString(),
    new URL('./favicon.svg', scope).toString(),
  ]
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(shell)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('movelya-static-') && key !== STATIC_CACHE).map((key) => caches.delete(key)))))
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting()
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || isSensitiveRequest(url)) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, new URL('./offline.html', self.registration.scope).toString()))
    return
  }
  if (['script', 'style', 'image', 'font'].includes(request.destination)) event.respondWith(cacheFirst(request))
})

self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'MOVELYA'
  const options = {
    body: data.body || 'Você tem uma nova atualização.',
    icon: new URL('./icon-192.png', self.registration.scope).toString(),
    badge: new URL('./favicon.svg', self.registration.scope).toString(),
    tag: data.tag || 'movelya-reminder',
    renotify: false,
    data: { url: data.url || './#/notificacoes' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url || './#/notificacoes', self.registration.scope).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const current = clients.find((client) => 'focus' in client)
    if (current) { current.navigate(destination); return current.focus() }
    return self.clients.openWindow(destination)
  }))
})

function isSensitiveRequest(url) {
  return url.pathname.includes('/rest/') || url.pathname.includes('/auth/v1/') || url.pathname.includes('/functions/')
}

async function cacheFirst(request) {
  const cached = await caches.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) { const cache = await caches.open(STATIC_CACHE); await cache.put(request, response.clone()) }
  return response
}

async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request)
    if (response.ok) { const cache = await caches.open(STATIC_CACHE); await cache.put(request, response.clone()) }
    return response
  } catch {
    return (await caches.match(request)) || (await caches.match(fallbackUrl)) || Response.error()
  }
}
