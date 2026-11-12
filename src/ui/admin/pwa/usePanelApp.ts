import { useEffect, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { registerPanelWorker } from "@/infrastructure/browser-push";

/** O que o Chrome entrega para mostrar o "Instalar app" no momento que a gente escolher. */
interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let installPrompt: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event as InstallPromptEvent;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    notify();
  });
}

/** Instalar o painel como app (Android e computador). Nulo quando o navegador não oferece ou já está instalado. */
export function useInstallPrompt(): (() => Promise<boolean>) | null {
  const available = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => installPrompt !== null,
  );
  if (!available) return null;
  return async () => {
    const event = installPrompt;
    if (!event) return false;
    await event.prompt();
    const { outcome } = await event.userChoice;
    installPrompt = null;
    notify();
    return outcome === "accepted";
  };
}

const HEAD_TAGS: ReadonlyArray<{ tag: "link" | "meta"; attributes: Record<string, string> }> = [
  { tag: "link", attributes: { rel: "manifest", href: "/admin.webmanifest" } },
  { tag: "meta", attributes: { name: "mobile-web-app-capable", content: "yes" } },
  { tag: "meta", attributes: { name: "apple-mobile-web-app-capable", content: "yes" } },
  { tag: "meta", attributes: { name: "apple-mobile-web-app-title", content: "Jota" } },
  { tag: "meta", attributes: { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" } },
];

/**
 * Painel como app: manifesto só dentro de /admin (o site da loja não vira app), service worker das notificações
 * e o clique na notificação abrindo a tela certa no painel que já está aberto.
 */
export function usePanelApp() {
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  });

  useEffect(() => {
    const elements = HEAD_TAGS.map(({ tag, attributes }) => {
      const element = document.createElement(tag);
      Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
      document.head.appendChild(element);
      return element;
    });
    return () => elements.forEach((element) => element.remove());
  }, []);

  useEffect(() => {
    registerPanelWorker().catch((error: unknown) => console.error("Falha ao registrar o service worker do painel", error));
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      const data = event.data as { type?: unknown; url?: unknown } | null;
      if (data?.type === "open" && typeof data.url === "string" && data.url.startsWith("/admin")) navigateRef.current(data.url);
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
}

/** Chama `onPush` quando chega uma notificação push com o painel aberto (o sininho atualiza na hora). */
export function usePushReceived(onPush: () => void) {
  const onPushRef = useRef(onPush);
  useEffect(() => {
    onPushRef.current = onPush;
  });
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onMessage = (event: MessageEvent<unknown>) => {
      if ((event.data as { type?: unknown } | null)?.type === "push-received") onPushRef.current();
    };
    navigator.serviceWorker.addEventListener("message", onMessage);
    return () => navigator.serviceWorker.removeEventListener("message", onMessage);
  }, []);
}
