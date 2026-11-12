// Service worker do painel (escopo /admin). Só cuida das notificações: não guarda páginas em cache,
// então o painel sempre abre a versão publicada mais nova.

const ICON = "/icons/icon-192.png";
const BADGE = "/icons/badge-96.png";
const FALLBACK_URL = "/admin";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

/** Só caminhos do painel: um aviso nunca leva para fora do sistema. */
function safeUrl(url) {
  return typeof url === "string" && /^\/admin(\/|$|\?)/.test(url) ? url : FALLBACK_URL;
}

function readPayload(event) {
  try {
    const data = event.data ? event.data.json() : {};
    return {
      title: typeof data.title === "string" && data.title ? data.title : "Jota Digitais",
      body: typeof data.body === "string" ? data.body : "",
      url: safeUrl(data.url),
      tag: typeof data.tag === "string" ? data.tag : undefined,
    };
  } catch {
    return { title: "Jota Digitais", body: event.data ? event.data.text() : "", url: FALLBACK_URL, tag: undefined };
  }
}

self.addEventListener("push", (event) => {
  const payload = readPayload(event);
  event.waitUntil(
    (async () => {
      // Painel aberto: o sininho atualiza na hora e toca o "plim".
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      windows.forEach((client) => client.postMessage({ type: "push-received" }));
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: ICON,
        badge: BADGE,
        tag: payload.tag,
        data: { url: payload.url },
        renotify: Boolean(payload.tag),
        vibrate: [120, 60, 120],
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = safeUrl(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const panel = windows.find((client) => new URL(client.url).pathname.startsWith("/admin"));
      if (panel) {
        await panel.focus();
        panel.postMessage({ type: "open", url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
