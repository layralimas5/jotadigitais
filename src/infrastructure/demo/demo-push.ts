import type { PushNotificationService } from "@/application/ports";
import { PUSH_KIND_OPTIONS, type PushDeviceStatus, type PushKind } from "@/domain/push";
import { askPermission, localPushStatus, showLocalNotification } from "../browser-push";

const ENABLED_KEY = "jota:demo-push";
const PREFERENCES_KEY = "jota:demo-push-kinds";
const KNOWN_KINDS = new Set<string>(PUSH_KIND_OPTIONS.map((option) => option.kind));

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch (error) {
    console.error("Não foi possível guardar a preferência de aviso", error);
  }
}

/**
 * Sem servidor não há push de verdade: ligar só pede a permissão e o teste mostra o aviso direto pelo
 * service worker, para conferir a aparência e o clique.
 */
export class DemoPushService implements PushNotificationService {
  async status(): Promise<PushDeviceStatus> {
    const local = localPushStatus();
    if (local !== "maybe-on") return local;
    return read(ENABLED_KEY) === "1" ? "on" : "off";
  }

  async enable(): Promise<void> {
    await askPermission();
    write(ENABLED_KEY, "1");
  }

  async disable(): Promise<void> {
    write(ENABLED_KEY, null);
  }

  async sendTest(): Promise<void> {
    await showLocalNotification("Teste do Jota Digitais", "Se você está lendo isto, as notificações estão funcionando neste aparelho.");
  }

  async loadPreferences(): Promise<PushKind[] | null> {
    const raw = read(PREFERENCES_KEY);
    if (!raw) return null;
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((kind): kind is PushKind => typeof kind === "string" && KNOWN_KINDS.has(kind)) : null;
    } catch {
      return null;
    }
  }

  async savePreferences(kinds: readonly PushKind[]): Promise<void> {
    write(PREFERENCES_KEY, JSON.stringify(kinds));
  }
}
