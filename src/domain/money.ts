export type Cents = number;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(value: Cents): string {
  return brl.format(value / 100);
}
