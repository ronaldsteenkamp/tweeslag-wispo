/* Pushmeldingen: wordt in de service worker geladen (workbox.importScripts in vite.config.ts). */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { titel: 'Tweeslag Wispo', tekst: event.data ? event.data.text() : '' }
  }
  const basis = self.registration.scope
  event.waitUntil(
    self.registration.showNotification(data.titel || 'Tweeslag Wispo', {
      body: data.tekst || '',
      icon: basis + 'pwa-192x192.png',
      badge: basis + 'pwa-64x64.png',
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: basis + (data.url || '') },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const doel = (event.notification.data && event.notification.data.url) || self.registration.scope
  event.waitUntil(
    (async () => {
      const vensters = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const v of vensters) {
        if (v.url.startsWith(self.registration.scope)) {
          await v.focus()
          if ('navigate' in v) await v.navigate(doel).catch(() => {})
          return
        }
      }
      await self.clients.openWindow(doel)
    })(),
  )
})
