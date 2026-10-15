import { z } from "zod";
import { followUpEventOf, type CalendarConnection, type CalendarEvent, type SyncSummary } from "@/domain/calendar";
import { toLocalIsoDate } from "@/domain/finance";
import { isOpenLead, type Lead } from "@/domain/lead";
import type { AdminDeps } from "./admin-use-cases";

const UPCOMING_DAYS = 7;

const connectionSchema = z.object({ email: z.string().min(3), connectedAt: z.string() });

/** Conta Google ligada, se houver. Desconectar grava `{}`, que não passa no schema e vira nulo. */
export async function getCalendarConnection(deps: AdminDeps): Promise<CalendarConnection | null> {
  const saved = connectionSchema.safeParse(await deps.preferences.get("google_calendar"));
  return saved.success ? saved.data : null;
}

export interface CalendarCapabilities {
  /** O sistema tem o ID do app do Google: dá para conectar. */
  configured: boolean;
  /** A agenda já foi aberta nesta visita. */
  hasAccess: boolean;
}

export function calendarCapabilities(deps: AdminDeps): CalendarCapabilities {
  return { configured: deps.calendar.configured, hasAccess: deps.calendar.hasAccess() };
}

export function prepareCalendar(deps: AdminDeps): Promise<void> {
  return deps.calendar.prepare();
}

export async function connectCalendar(deps: AdminDeps): Promise<CalendarConnection> {
  const connection = await deps.calendar.connect();
  await deps.preferences.set("google_calendar", connection);
  return connection;
}

export async function disconnectCalendar(deps: AdminDeps): Promise<void> {
  await deps.calendar.disconnect();
  await deps.preferences.set("google_calendar", {});
}

export function listUpcomingEvents(deps: AdminDeps): Promise<CalendarEvent[]> {
  return deps.calendar.upcoming(UPCOMING_DAYS);
}

const hasFollowUpFrom = (today: string) => (lead: Lead): lead is Lead & { nextFollowUp: string } =>
  isOpenLead(lead) && lead.nextFollowUp !== null && lead.nextFollowUp >= today;

/** Retornos marcados no CRM (de hoje em diante) viram compromissos. Rodar de novo atualiza, não duplica. */
export async function syncFollowUpsToCalendar(deps: AdminDeps): Promise<SyncSummary> {
  const leads = (await deps.leads.listAll()).filter(hasFollowUpFrom(toLocalIsoDate(new Date())));
  const summary: SyncSummary = { created: 0, updated: 0 };
  for (const lead of leads) {
    const result = await deps.calendar.upsertAllDayEvent(followUpEventOf(lead));
    summary[result] += 1;
  }
  return summary;
}
