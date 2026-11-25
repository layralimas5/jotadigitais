/**
 * WhatsApp do cliente como fica no banco:
 * - Brasil: só dígitos, com DDD (o DDI 55 é opcional), de 10 a 13 dígitos.
 * - Fora do Brasil: "+" e o número completo com o código do país (E.164), ex.: "+351925812020".
 * O "+" é o que separa um do outro: sem ele, um número dos EUA (1 + 10 dígitos) se confunde com um celular daqui.
 */
export const BRAZIL_COUNTRY_CODE = "55";

/** Mesma regra da checagem `orders_customer_whatsapp_check` no banco para número de fora. */
export const INTERNATIONAL_WHATSAPP_PATTERN = /^\+[1-9]\d{7,14}$/;

const digitsOf = (phone: string) => phone.replace(/\D/g, "");

/** Número de outro país (começa com "+" e não é +55). */
export const isInternationalWhatsapp = (phone: string): boolean =>
  phone.trim().startsWith("+") && !digitsOf(phone).startsWith(BRAZIL_COUNTRY_CODE);

/**
 * Normaliza o que o cliente digitou: "+351 925 812 020" vira "+351925812020";
 * "+55 (11) 91234-5678" e "(11) 91234-5678" viram só dígitos, como sempre foi.
 */
export function normalizeWhatsapp(raw: string): string {
  return isInternationalWhatsapp(raw) ? `+${digitsOf(raw)}` : digitsOf(raw);
}

/** Identificador do WhatsApp (wa.me e API): só dígitos com o DDI. Sem DDI, é do Brasil. */
export function whatsappIdOf(phone: string): string {
  const digits = digitsOf(phone);
  if (isInternationalWhatsapp(phone)) return digits;
  return digits.startsWith(BRAZIL_COUNTRY_CODE) && digits.length >= 12 ? digits : `${BRAZIL_COUNTRY_CODE}${digits}`;
}

/** Campo de número de fora: sempre com "+" na frente, só dígitos depois, até 15 (limite do E.164). */
export function formatInternationalInput(raw: string): string {
  const digits = digitsOf(raw).slice(0, 15);
  return digits ? `+${digits}` : "";
}
