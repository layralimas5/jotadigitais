/** Atendimento do suporte da desenvolvedora: segunda a sexta, das 08:00 às 20:00 (horário de Brasília). */
export const SUPPORT_HOURS_LABEL = "segunda a sexta, das 08:00 às 20:00";

/** WhatsApp da desenvolvedora, para o que for urgente fora do horário. */
export const DEVELOPER_WHATSAPP = "5527999954123";

const OPENS_AT_HOUR = 8;
const CLOSES_AT_HOUR = 20;

/** Fora do horário: fim de semana ou dia útil antes das 08:00 / a partir das 20:00. */
export type SupportOffHours = "weekend" | "after-hours";

const BRAZIL_CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short", hour: "numeric", hourCycle: "h23" });

/** Situação do atendimento no horário de Brasília, seja qual for o fuso do aparelho. Null: dentro do expediente. */
export function supportOffHoursOf(now: Date): SupportOffHours | null {
  const parts = BRAZIL_CLOCK.formatToParts(now);
  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  if (weekday === "Sat" || weekday === "Sun") return "weekend";
  return hour < OPENS_AT_HOUR || hour >= CLOSES_AT_HOUR ? "after-hours" : null;
}
