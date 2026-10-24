export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const amountFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatBRL(value: Cents): string {
  return brl.format(value / 100);
}

/** "370", "370,00" e "1.250,50" viram centavos. Texto vazio ou inválido vira NaN. */
export function parseMoneyToCents(text: string): Cents {
  const normalized = text.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

/** Centavos no formato de campo de valor, sem o R$: 125050 vira "1.250,50". */
export function formatCentsInput(cents: Cents): string {
  return amountFormat.format(cents / 100);
}
