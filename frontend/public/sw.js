// Orkestri Service Worker
const CACHE_NAME = "orkestri-v1";
self.addEventListener("install", (e) => { self.skipWaiting(); });
self.addEventListener("activate", (e) => { e.waitUntil(clients.claim()); });

self.addEventListener("message", (e) => {
  if (!e.data || e.data.type !== "SCHEDULE_NOTIFICATION") return;
  const { id, titulo, inicio, minutos } = e.data;
  const agora = Date.now();
  const eventoMs = new Date(inicio).getTime();
  const alertaMs = eventoMs - (minutos * 60 * 1000);
  const delay = alertaMs - agora;
  if (delay <= 0) return;
  setTimeout(() => {
    const hora = new Date(inicio).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    const tituloNotif = minutos === 0 ? "Acontecendo agora" : "Orkestri - em " + minutos + " min";
    const body = titulo + " as " + hora;
    self.registration.showNotification(tituloNotif, {
      body: body,
      icon: "/icon-192.png",
      tag: "orkestri-" + id + "-" + minutos,
      renotify: true,
      data: { url: "/dashboard/agenda" },
    });
  }, delay);
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) ? e.notification.data.url : "/dashboard";
  e.waitUntil(
    clients.matchAll({ type: "window" }).then((list) => {
      for (const client of list) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});