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

export function instagramUrlOf(settings: StoreSettings): string {
  return `https://www.instagram.com/${settings.instagramHandle.replace(/^@/, "")}`;
}
