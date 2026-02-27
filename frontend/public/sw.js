/* Service worker for PWA (Add to Home Screen) + Web Push notifications */
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))
self.addEventListener("fetch", () => {})

// Web Push: show notification when server sends a push (e.g. new message)
self.addEventListener("push", function (event) {
  if (!event.data) return
  var data = {}
  try {
    data = event.data.json()
  } catch (_) {
    data = { title: "Allesinda", body: event.data.text() || "Neue Benachrichtigung" }
  }
  var title = data.title || "Neue Nachricht"
  var body = data.body || "Sie haben eine neue Nachricht."
  var url = data.url || "/messages"
  var tag = data.tag || "message"
  var options = {
    body: body,
    tag: tag,
    icon: "/icon-192.png",
    badge: "/icon-72.png",
    data: { url: url },
    requireInteraction: false,
    vibrate: [200, 100, 200],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// When user taps the notification, open the app (or focus existing tab)
self.addEventListener("notificationclick", function (event) {
  event.notification.close()
  var url = event.notification.data && event.notification.data.url ? event.notification.data.url : "/messages"
  var fullUrl = new URL(url, self.registration.scope).href
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        if (clientList[i].url.indexOf(self.registration.scope) === 0 && "focus" in clientList[i]) {
          clientList[i].navigate(fullUrl)
          return clientList[i].focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})
