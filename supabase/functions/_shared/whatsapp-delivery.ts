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

/** Resposta quando o código é de um pedido feito com outro número: a conversa vai para o Jota. */
export const WRONG_PHONE_REPLY =
  "Esse pedido foi feito com outro número de WhatsApp. Por segurança, o acesso só sai no número informado na compra. " +
  "Já chamei o Jota para te ajudar por aqui.";

/** Texto que a página do pedido pago deixa pronto no WhatsApp: o código faz o acesso sair sozinho. */
export const accessRequestText = (orderCode: string) => `Quero receber meu acesso. Pedido ${orderCode}.`;

const ORDER_CODE = /\bJD-[A-Z0-9]{6}\b/i;

/**
 * Pedido de acesso que chegou no WhatsApp: o toque em "Receber meu acesso" (payload `acesso:JD-...`) ou a mensagem
 * da página do pedido, que traz o código. Sem código, é conversa comum.
 */
export function accessCodeOf(body: string, buttonPayload: string | null = null): string | null {
  const source = buttonPayload?.startsWith("acesso:") ? buttonPayload.slice("acesso:".length) : body;
  return source.match(ORDER_CODE)?.[0]?.toUpperCase() ?? null;
}

/**
 * Celular do Brasil sem o nono dígito: a Meta às vezes manda o número do cliente sem ele (55 + DDD + 8 dígitos),
 * enquanto o checkout grava com. As duas formas viram a mesma chave.
 */
function phoneKey(phone: string): string {
  const id = toWhatsAppId(phone);
  return id.length === 13 && id.startsWith("55") && id[4] === "9" ? id.slice(0, 4) + id.slice(5) : id;
}

export const samePhone = (a: string, b: string): boolean => phoneKey(a) === phoneKey(b);

/** As duas formas do mesmo celular (com e sem o nono dígito), para achar a conversa de quem comprou. */
export function phoneVariants(phone: string): string[] {
  const key = phoneKey(phone);
  return key.length === 12 && key.startsWith("55") ? [key, `${key.slice(0, 4)}9${key.slice(4)}`] : [key];
}

// ---------------------------------------------------------------------------
// Lembrete de pedido não pago e pós-venda. Textos idênticos aos modelos cadastrados na Meta.
// ---------------------------------------------------------------------------

export const REMINDER_TEMPLATE = { name: "pedido_aguardando", language: "pt_BR" } as const;
export const AFTER_SALE_TEMPLATE = { name: "pos_venda", language: "pt_BR" } as const;

/** Variáveis do lembrete, na ordem {{1}} a {{5}}. `until` é a hora (ex.: 14:30) e `link`, a página do pedido. */
export interface ReminderValues {
  name: string;
  orderCode: string;
  accounts: string;
  until: string;
  link: string;
}

export function reminderText(values: ReminderValues): string {
  return (
    `Oi, ${values.name}! Seu pedido ${values.orderCode} da conta ${values.accounts} está reservado até ${values.until}. ` +
    `Para pagar, é só abrir ${values.link} antes desse horário.`
  );
}

export const reminderParams = (values: ReminderValues): string[] =>
  [values.name, values.orderCode, values.accounts, values.until, values.link].map((value) => value.replace(/\s+/g, " ").trim());

/** Variáveis do pós-venda, na ordem {{1}} e {{2}}. */
export interface AfterSaleValues {
  name: string;
  accounts: string;
}

export function afterSaleText(values: AfterSaleValues): string {
  return (
    `Oi, ${values.name}! Deu tudo certo com a conta ${values.accounts}? ` +
    "Se precisar de ajuda com a troca de nome, foto ou @, é só responder esta mensagem."
  );
}

export const afterSaleParams = (values: AfterSaleValues): string[] =>
  [values.name, values.accounts].map((value) => value.replace(/\s+/g, " ").trim());
