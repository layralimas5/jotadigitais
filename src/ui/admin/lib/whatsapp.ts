/** Link de conversa no WhatsApp. Número sem DDI ganha o 55 do Brasil. */
export function whatsappChatUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return text ? `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}` : `https://wa.me/${withCountry}`;
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;
