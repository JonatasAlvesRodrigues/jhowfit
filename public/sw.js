self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch { data = { body: event.data ? event.data.text() : '' } }
  const title = data.title || 'MOVELYA'
  const options = {
    body: data.body || 'Você tem uma nova atualização.',
    icon: '/movelya-logo.png',
    badge: '/favicon.svg',
    tag: data.tag || 'movelya-reminder',
    renotify: false,
    data: { url: data.url || '/notificacoes' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const destination = new URL(event.notification.data?.url || '/notificacoes', self.location.origin).href
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
    const current = clients.find((client) => 'focus' in client)
    if (current) { current.navigate(destination); return current.focus() }
    return self.clients.openWindow(destination)
  }))
})

