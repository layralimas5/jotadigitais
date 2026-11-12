import type { PushDeviceStatus } from "@/domain/push";

/** Service worker do painel: mostra a notificação com o painel fechado. Só vale dentro de /admin. */
const PANEL_WORKER_URL = "/sw.js";
const PANEL_SCOPE = "/admin";

export class PushSetupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PushSetupError";
  }
}

export const browserSupportsPush = (): boolean =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

const isAppleMobile = (): boolean =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

/** Aberto pelo ícone da Tela de Início (ou como app instalado no Android e no computador). */
export const runsAsInstalledApp = (): boolean =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;

/** iPhone e iPad só têm push com o painel adicionado à Tela de Início (iOS 16.4 ou mais novo). */
export const needsHomeScreenInstall = (): boolean => isAppleMobile() && !runsAsInstalledApp();

/** O que dá para saber sem perguntar ao servidor. `on` aqui ainda depende do servidor confirmar o aparelho. */
export function localPushStatus(): Exclude<PushDeviceStatus, "on"> | "maybe-on" {
  if (needsHomeScreenInstall()) return "needs-install";
  if (!browserSupportsPush()) return "unsupported";
  if (Notification.permission === "denied") return "blocked";
  return Notification.permission === "granted" ? "maybe-on" : "off";
}

export async function registerPanelWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  return navigator.serviceWorker.register(PANEL_WORKER_URL, { scope: PANEL_SCOPE });
}

async function panelRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await registerPanelWorker();
  if (!registration) throw new PushSetupError("Este navegador não aceita notificações. Use o Chrome, o Edge ou o Safari atualizado.");
  await navigator.serviceWorker.ready;
  return registration;
}

/** Pede a permissão. Precisa vir direto de um clique (o iPhone recusa sem isso). */
export async function askPermission(): Promise<void> {
  const answer = await Notification.requestPermission();
  if (answer === "granted") return;
  throw new PushSetupError(
    answer === "denied"
      ? "As notificações foram bloqueadas neste aparelho. Libere nos ajustes do navegador e tente de novo."
      : "Para receber os avisos, toque em Permitir quando o aparelho perguntar.",
  );
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (!browserSupportsPush()) return null;
  const registration = await navigator.serviceWorker.getRegistration(PANEL_SCOPE);
  return registration ? registration.pushManager.getSubscription() : null;
}

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export interface DeviceSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** Inscreve este aparelho no serviço de push do navegador (Google, Apple ou Mozilla). */
export async function subscribeDevice(vapidPublicKey: string): Promise<DeviceSubscription> {
  const registration = await panelRegistration();
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(vapidPublicKey) }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) {
    throw new PushSetupError("O navegador não entregou o endereço de aviso. Tente de novo.");
  }
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth };
}

/** Mostra um aviso direto pelo service worker, sem servidor (modo demonstração). */
export async function showLocalNotification(title: string, body: string): Promise<void> {
  const registration = await panelRegistration();
  await registration.showNotification(title, { body, icon: "/icons/icon-192.png", badge: "/icons/badge-96.png", data: { url: "/admin/configuracoes" } });
}

/** Nome curto do aparelho para a lista: "iPhone · Safari", "Android · Chrome". */
export function describeDevice(): string {
  const ua = navigator.userAgent;
  const device = isAppleMobile() ? (/iPad/.test(ua) ? "iPad" : "iPhone") : /Android/.test(ua) ? "Android" : "Computador";
  const browser = /Edg\//.test(ua) ? "Edge" : /SamsungBrowser/.test(ua) ? "Samsung" : /CriOS|Chrome\//.test(ua) ? "Chrome" : /Firefox|FxiOS/.test(ua) ? "Firefox" : /Safari/.test(ua) ? "Safari" : "Navegador";
  return `${device} · ${browser}`;
}
