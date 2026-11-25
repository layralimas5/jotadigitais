import { isInternationalWhatsapp, normalizeWhatsapp, whatsappIdOf } from "@/domain/whatsapp-number";

/** Link de conversa no WhatsApp. Número sem DDI ganha o 55 do Brasil; número com "+" de outro país vai como está. */
export function whatsappChatUrl(phone: string, text?: string): string {
  const id = whatsappIdOf(phone);
  return text ? `https://wa.me/${id}?text=${encodeURIComponent(text)}` : `https://wa.me/${id}`;
}

/** "11912345678" (com ou sem o 55) vira "(11) 91234-5678". Número de fora fica "+351925812020". Fora do padrão volta como veio. */
export function formatPhone(phone: string): string {
  if (isInternationalWhatsapp(phone)) return normalizeWhatsapp(phone);
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(local);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;
