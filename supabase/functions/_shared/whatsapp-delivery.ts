// Regras da entrega pelo WhatsApp que o painel e a função whatsapp-send compartilham. Sem imports: roda no Deno e no Vite.

/** Nome e idioma do modelo aprovado na Meta. O texto abaixo precisa ser idêntico ao cadastrado lá. */
export const PAYMENT_TEMPLATE = { name: "pagamento_confirmado", language: "pt_BR", button: "Receber meu acesso" } as const;

/** Variáveis do modelo, na ordem {{1}}, {{2}}, {{3}}. A Meta recusa variável com quebra de linha. */
export interface PaymentPromptValues {
  name: string;
  orderCode: string;
  accounts: string;
}

export function paymentPromptText(values: PaymentPromptValues): string {
  return (
    `Oi, ${values.name}! O pagamento do pedido ${values.orderCode} foi confirmado. ` +
    `Toque em *${PAYMENT_TEMPLATE.button}* para receber os dados de ${values.accounts} aqui no WhatsApp.`
  );
}

export const paymentPromptParams = (values: PaymentPromptValues): string[] =>
  [values.name, values.orderCode, values.accounts].map((value) => value.replace(/\s+/g, " ").trim());

/** O toque no botão volta para o webhook com este código: diz de qual pedido (ou carrinho) entregar o acesso. */
export const accessButtonPayload = (orderCode: string) => `acesso:${orderCode}`;

/** Número do checkout (com ou sem DDI) no formato da API: só dígitos, com o 55 do Brasil. */
export function toWhatsAppId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") && digits.length >= 12 ? digits : `55${digits}`;
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/** "@a", "@a e @b", "@a, @b e @c". */
export function joinHandles(handles: readonly string[]): string {
  if (handles.length <= 1) return handles[0] ?? "";
  return `${handles.slice(0, -1).join(", ")} e ${handles[handles.length - 1]}`;
}

/** No registro do painel a senha aparece assim: a mensagem real sai com ela, o histórico não guarda. */
export const MASKED_SECRET = "••••••";
