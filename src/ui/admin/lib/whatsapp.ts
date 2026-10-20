/** Link de conversa no WhatsApp. Número sem DDI ganha o 55 do Brasil. */
export function whatsappChatUrl(phone: string, text?: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
  return text ? `https://wa.me/${withCountry}?text=${encodeURIComponent(text)}` : `https://wa.me/${withCountry}`;
}

/** "11912345678" (com ou sem o 55) vira "(11) 91234-5678". Número fora do padrão volta como veio. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const match = /^(\d{2})(\d{4,5})(\d{4})$/.exec(local);
  return match ? `(${match[1]}) ${match[2]}-${match[3]}` : phone;
}

export const firstNameOf = (name: string) => name.trim().split(/\s+/)[0] ?? name;
