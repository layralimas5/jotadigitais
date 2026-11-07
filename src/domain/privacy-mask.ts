/**
 * Máscaras do modo "ver como o Jota": a desenvolvedora enxerga o formato do dado sem o dado.
 * Mantêm pedaços do começo e do fim para que clientes diferentes continuem diferentes na tela
 * (o agrupamento de clientes usa e-mail e WhatsApp como chave).
 */

const DOT = "•";
const dots = (count: number) => DOT.repeat(Math.max(count, 3));

/** "mariana.silva@gmail.com" → "ma•••va@gmail.com". */
export function maskEmail(email: string | null): string | null {
  if (!email) return email;
  const [local = "", domain = ""] = email.split("@");
  if (local.length <= 4) return `${local.slice(0, 1)}${dots(3)}@${domain}`;
  return `${local.slice(0, 2)}${dots(3)}${local.slice(-2)}@${domain}`;
}

/** "5584981225361" → "5584•••••5361": DDD e quatro últimos, como numa fatura. */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  const digits = phone.replace(/\D/g, "");
  if (digits.length <= 6) return dots(digits.length);
  const head = digits.length > 11 ? 4 : 2;
  return `${digits.slice(0, head)}${dots(digits.length - head - 4)}${digits.slice(-4)}`;
}

/** "Maria Clara Souza" → "Maria S.": dá para diferenciar sem identificar. */
export function maskPersonName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return name.trim();
  const last = parts[parts.length - 1] ?? "";
  return `${parts[0]} ${last.charAt(0).toUpperCase()}.`;
}

/** "@mariana.silva" → "@ma•••". */
export function maskHandle(handle: string | null): string | null {
  if (!handle) return handle;
  const clean = handle.replace(/^@/, "");
  return `@${clean.slice(0, 2)}${dots(3)}`;
}

/** Senhas, chaves Pix e documentos: só mostra que existe. */
export const maskSecret = (value: string | null): string | null => (value ? dots(8) : value);

export const HIDDEN_NOTE = "Texto oculto no modo visualização.";

/** Observação livre pode ter qualquer coisa (senha, data de nascimento): some inteira. */
export const maskNote = (note: string | null): string | null => (note ? HIDDEN_NOTE : note);
