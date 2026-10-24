/** Dados de contato e de garantia que o Jota ajusta pelo painel e o site inteiro usa. */
export interface StoreSettings {
  /** Só dígitos, com DDI (ex.: 5511999999999). Nulo esconde os botões de WhatsApp. */
  whatsappNumber: string | null;
  /** Sempre com @ na frente. */
  instagramHandle: string;
  guaranteeDays: number;
  /** Chave Pix da conta Nubank que recebe. Sem ela o checkout não oferece Pix. */
  pixKey: string | null;
  /** Nome que aparece para o cliente no app do banco ao pagar (até 25 caracteres). */
  pixReceiverName: string | null;
  /** Cidade do recebedor (até 15 caracteres), exigida no código Pix. */
  pixReceiverCity: string | null;
}

/** Pix só entra no checkout com chave, nome e cidade: os três vão no código copia e cola. */
export const acceptsPix = (settings: StoreSettings) =>
  Boolean(settings.pixKey && settings.pixReceiverName && settings.pixReceiverCity);

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
