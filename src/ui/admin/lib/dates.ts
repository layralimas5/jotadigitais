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
