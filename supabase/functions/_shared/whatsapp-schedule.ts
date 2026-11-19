// Horário de atendimento da IA, compartilhado entre o painel e as funções. Sem imports: roda no Deno e no Vite.

export const STORE_TIME_ZONE = "America/Sao_Paulo";

/** always: a IA responde 24h; off_hours: só fora do horário comercial (no horário quem responde é o Jota). */
export type AiSchedule = "always" | "off_hours";

export interface BusinessHours {
  schedule: AiSchedule;
  /** "HH:MM", hora de Brasília. */
  start: string;
  end: string;
  /** 0 = domingo ... 6 = sábado. */
  days: readonly number[];
}

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Dia da semana e minuto do dia no fuso da loja. */
export function storeClock(at: Date): { day: number; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: STORE_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  return { day: WEEKDAY_INDEX[value("weekday")] ?? 0, minutes: Number(value("hour")) * 60 + Number(value("minute")) };
}

const toMinutes = (time: string) => {
  const [hours = "0", minutes = "0"] = time.split(":");
  return Number(hours) * 60 + Number(minutes);
};

export function isBusinessHours(hours: BusinessHours, at: Date): boolean {
  const { day, minutes } = storeClock(at);
  return hours.days.includes(day) && minutes >= toMinutes(hours.start) && minutes < toMinutes(hours.end);
}

/** A IA responde agora? Com "só fora do horário", ela fica quieta enquanto a loja está aberta. */
export const aiAnswersAt = (hours: BusinessHours, at: Date): boolean =>
  hours.schedule === "always" || !isBusinessHours(hours, at);

/** "parar", "sair", "stop": o cliente não quer mais mensagens automáticas. */
export const isOptOut = (text: string): boolean => /^\s*(parar|pare|sair|stop|cancelar mensagens)\s*[.!]*\s*$/i.test(text);

/** O cliente voltou a pedir atendimento depois de parar. */
export const isOptIn = (text: string): boolean => /^\s*(voltar|iniciar|start)\s*[.!]*\s*$/i.test(text);
