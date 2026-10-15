const percentFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

/** 30 vira "30%"; 12.5 vira "12,5%". */
export const formatPercent = (value: number) => `${percentFormat.format(value)}%`;

/** "30", "12,5" e "12.5" viram número. Texto vazio ou inválido vira NaN para o zod acusar. */
export function parsePercent(text: string): number {
  const normalized = text.replace(/[%\s]/g, "").replace(",", ".");
  return /^\d+(\.\d+)?$/.test(normalized) ? Number(normalized) : Number.NaN;
}
