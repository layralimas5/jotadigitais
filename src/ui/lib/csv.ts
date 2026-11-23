/**
 * Célula com ponto e vírgula, aspas ou quebra de linha vai entre aspas (aspas internas dobradas). Texto que começa
 * como fórmula (=, +, -, @) ganha um apóstrofo: nome digitado por afiliado não vira fórmula no Excel.
 */
function cell(value: string | number | null): string {
  const raw = value === null ? "" : String(value);
  const text = typeof value === "string" && /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return /[;"\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Planilha separada por ponto e vírgula, com BOM: o Excel em português abre com acento e colunas certas. */
export function toCsv(rows: readonly (readonly (string | number | null)[])[]): string {
  return `﻿${rows.map((row) => row.map(cell).join(";")).join("\r\n")}`;
}

export function downloadCsv(filename: string, rows: readonly (readonly (string | number | null)[])[]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** R$ 12,34 vira "12,34": número que o Excel em português soma. */
export const csvMoney = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
