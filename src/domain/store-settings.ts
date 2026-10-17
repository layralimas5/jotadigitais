/** Dados de contato e de garantia que o Jota ajusta pelo painel e o site inteiro usa. */
export interface StoreSettings {
  /** Só dígitos, com DDI (ex.: 5511999999999). Nulo esconde os botões de WhatsApp. */
  whatsappNumber: string | null;
  /** Sempre com @ na frente. */
  instagramHandle: string;
  guaranteeDays: number;
}

export function whatsappUrlOf(settings: StoreSettings): string | null {
  return settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber}` : null;
}

/** Abre a conversa com o Jota já com a mensagem escrita, pronta para o visitante enviar. */
export function whatsappMessageUrl(whatsappUrl: string, message: string): string {
  return `${whatsappUrl}?text=${encodeURIComponent(message.trim())}`;
}

export function instagramUrlOf(settings: StoreSettings): string {
  return `https://www.instagram.com/${settings.instagramHandle.replace(/^@/, "")}`;
}
