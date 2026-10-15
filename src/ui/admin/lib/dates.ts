/** Data local no formato AAAA-MM-DD, igual ao `date` do banco e do `<input type="date">`. */
export function localIsoDate(date: Date = new Date()): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const longDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

/** "14 de out." a partir de AAAA-MM-DD, sem o fuso puxar para o dia anterior. */
export function formatIsoDate(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return shortDate.format(new Date(year ?? 0, (month ?? 1) - 1, day ?? 1));
}

export const formatDate = (timestamp: string) => longDate.format(new Date(timestamp));

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** "agora", "há 5 min", "há 3 h", "ontem" ou a data, para avisos recentes. */
export function formatRelative(timestamp: string, now: Date = new Date()): string {
  const elapsed = now.getTime() - new Date(timestamp).getTime();
  if (elapsed < MINUTE_MS) return "agora";
  if (elapsed < HOUR_MS) return `há ${Math.floor(elapsed / MINUTE_MS)} min`;
  if (elapsed < DAY_MS) return `há ${Math.floor(elapsed / HOUR_MS)} h`;
  if (elapsed < 2 * DAY_MS) return "ontem";
  return shortDate.format(new Date(timestamp));
}
