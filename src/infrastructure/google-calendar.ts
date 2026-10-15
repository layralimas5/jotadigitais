import { z } from "zod";
import type { CalendarService } from "@/application/ports";
import {
  CalendarError,
  type CalendarConnection,
  type CalendarEvent,
  type CalendarEventDraft,
  type UpsertResult,
} from "@/domain/calendar";

// Login do Google pelo Google Identity Services: o Jota escolhe a conta numa janela do próprio Google e o
// sistema recebe uma permissão temporária (cerca de 1 hora), guardada só na memória desta aba.

const GIS_SCRIPT = "https://accounts.google.com/gsi/client";
const SCOPES = "https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const USERINFO_API = "https://www.googleapis.com/oauth2/v3/userinfo";
const EXPIRY_MARGIN_MS = 60_000;
const MAX_UPCOMING = 10;

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string; hint?: string }): void;
}

interface GoogleOAuth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2 } };
  }
}

let scriptLoading: Promise<GoogleOAuth2> | null = null;

/** Carrega o script do Google só quando alguém clica em Conectar: quem não usa a agenda não baixa nada. */
function loadGoogleOAuth(): Promise<GoogleOAuth2> {
  const ready = window.google?.accounts?.oauth2;
  if (ready) return Promise.resolve(ready);
  scriptLoading ??= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GIS_SCRIPT;
    script.async = true;
    script.onload = () => {
      const oauth2 = window.google?.accounts?.oauth2;
      if (oauth2) resolve(oauth2);
      else reject(new CalendarError("failed"));
    };
    script.onerror = () => {
      scriptLoading = null;
      reject(new CalendarError("failed"));
    };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

// Resposta de fora: campos opcionais aceitam ausente ou nulo.
const eventSchema = z.object({
  id: z.string(),
  summary: z.string().nullish(),
  htmlLink: z.string().nullish(),
  start: z.object({ date: z.string().nullish(), dateTime: z.string().nullish() }),
});

const eventListSchema = z.object({ items: z.array(eventSchema).default([]) });
const userInfoSchema = z.object({ email: z.string() });

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + days));
  return date.toISOString().slice(0, 10);
}

export class GoogleCalendarService implements CalendarService {
  private token: { value: string; expiresAt: number } | null = null;

  constructor(private readonly clientId: string | null) {}

  get configured(): boolean {
    return this.clientId !== null;
  }

  hasAccess(): boolean {
    return this.token !== null && this.token.expiresAt - EXPIRY_MARGIN_MS > Date.now();
  }

  async prepare(): Promise<void> {
    if (this.clientId) await loadGoogleOAuth();
  }

  async connect(): Promise<CalendarConnection> {
    await this.requestToken();
    const info = userInfoSchema.parse(await this.call(USERINFO_API));
    return { email: info.email, connectedAt: new Date().toISOString() };
  }

  async disconnect(): Promise<void> {
    const token = this.token?.value;
    this.token = null;
    if (!token) return;
    const oauth2 = await loadGoogleOAuth().catch(() => null);
    oauth2?.revoke(token);
  }

  async upcoming(days: number): Promise<CalendarEvent[]> {
    const now = new Date();
    const params = new URLSearchParams({
      timeMin: now.toISOString(),
      timeMax: new Date(now.getTime() + days * 86_400_000).toISOString(),
      singleEvents: "true",
      orderBy: "startTime",
      maxResults: String(MAX_UPCOMING),
    });
    const list = eventListSchema.parse(await this.call(`${CALENDAR_API}?${params}`));
    return list.items.map((item) => ({
      id: item.id,
      title: item.summary || "(sem título)",
      start: item.start.date ?? item.start.dateTime ?? "",
      allDay: Boolean(item.start.date),
      link: item.htmlLink ?? null,
    }));
  }

  async upsertAllDayEvent(draft: CalendarEventDraft): Promise<UpsertResult> {
    const body = {
      summary: draft.title,
      description: draft.description,
      start: { date: draft.date },
      end: { date: addDays(draft.date, 1) },
      extendedProperties: { private: { jotaKey: draft.key } },
    };
    const search = new URLSearchParams({ privateExtendedProperty: `jotaKey=${draft.key}`, maxResults: "1" });
    const existing = eventListSchema.parse(await this.call(`${CALENDAR_API}?${search}`)).items[0];
    if (existing) {
      await this.call(`${CALENDAR_API}/${encodeURIComponent(existing.id)}`, { method: "PATCH", body: JSON.stringify(body) });
      return "updated";
    }
    await this.call(CALENDAR_API, { method: "POST", body: JSON.stringify(body) });
    return "created";
  }

  /** Abre a janela do Google. Precisa partir de um clique, senão o navegador bloqueia a janela. */
  private async requestToken(): Promise<void> {
    if (!this.clientId) throw new CalendarError("not_configured");
    const oauth2 = await loadGoogleOAuth();
    const clientId = this.clientId;
    await new Promise<void>((resolve, reject) => {
      const client = oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES,
        callback: (response) => {
          if (!response.access_token || response.error) {
            reject(new CalendarError("denied"));
            return;
          }
          this.token = { value: response.access_token, expiresAt: Date.now() + (response.expires_in ?? 3600) * 1000 };
          resolve();
        },
        error_callback: (error) => reject(new CalendarError(error.type === "popup_closed" ? "popup_closed" : "failed")),
      });
      client.requestAccessToken({ prompt: "" });
    });
  }

  private async call(url: string, init: RequestInit = {}): Promise<unknown> {
    if (!this.hasAccess() || !this.token) throw new CalendarError("expired");
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        headers: { Authorization: `Bearer ${this.token.value}`, "Content-Type": "application/json", ...init.headers },
      });
    } catch {
      throw new CalendarError("failed");
    }
    if (response.status === 401) {
      this.token = null;
      throw new CalendarError("expired");
    }
    if (response.status === 403) throw new CalendarError("denied");
    if (!response.ok) throw new CalendarError("failed");
    return response.status === 204 ? null : response.json();
  }
}
