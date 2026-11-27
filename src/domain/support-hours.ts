/** Atendimento do suporte da desenvolvedora: segunda a sexta, das 08:00 às 20:00 (horário de Brasília). */
export const SUPPORT_HOURS_LABEL = "segunda a sexta, das 08:00 às 20:00";

/** WhatsApp da desenvolvedora, para o que for urgente fora do horário. */
export const DEVELOPER_WHATSAPP = "5527999954123";

const BRAZIL_WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "America/Sao_Paulo", weekday: "short" });

/** Sábado ou domingo no horário de Brasília, seja qual for o fuso do aparelho. */
export function isSupportWeekend(now: Date): boolean {
  const weekday = BRAZIL_WEEKDAY.format(now);
  return weekday === "Sat" || weekday === "Sun";
}
