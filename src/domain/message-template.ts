export const MESSAGE_TEMPLATE_KEYS = [
  "order_received",
  "payment_confirmed",
  "order_delivered",
  "crm_follow_up",
  "customer_hello",
  "account_offer",
] as const;

export type MessageTemplateKey = (typeof MESSAGE_TEMPLATE_KEYS)[number];

export type MessageTemplates = Record<MessageTemplateKey, string>;

export const TEMPLATE_VARIABLES = ["nome", "pedido", "conta", "valor", "loja", "rede", "detalhes", "link"] as const;

export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];

export type TemplateValues = Partial<Record<TemplateVariable, string>>;

export const MESSAGE_TEMPLATE_INFO: Record<MessageTemplateKey, { title: string; when: string; variables: readonly TemplateVariable[] }> = {
  order_received: {
    title: "Pedido recebido",
    when: "Pedido aguardando pagamento",
    variables: ["nome", "pedido", "conta", "valor", "loja"],
  },
  payment_confirmed: {
    title: "Pagamento confirmado",
    when: "Pedido pago, falta entregar",
    variables: ["nome", "pedido", "conta", "loja"],
  },
  order_delivered: {
    title: "Conta entregue",
    when: "Pedido entregue",
    variables: ["nome", "pedido", "conta", "loja"],
  },
  crm_follow_up: {
    title: "Retorno do CRM",
    when: "Chamar um lead de novo",
    variables: ["nome", "loja"],
  },
  customer_hello: {
    title: "Contato com cliente",
    when: "Falar com quem já comprou",
    variables: ["nome", "loja"],
  },
  account_offer: {
    title: "Oferecer conta",
    when: "Enviar os dados de uma conta para quem quer comprar",
    variables: ["nome", "conta", "rede", "detalhes", "valor", "link", "loja"],
  },
};

export const DEFAULT_MESSAGE_TEMPLATES: MessageTemplates = {
  order_received:
    "Olá, {nome}! Aqui é da {loja}. Recebemos seu pedido {pedido} da conta {conta} ({valor}). Assim que o pagamento cair, te aviso por aqui.",
  payment_confirmed:
    "Oi, {nome}! Pagamento do pedido {pedido} confirmado. Já estou separando o acesso da conta {conta} para você.",
  order_delivered:
    "Pronto, {nome}! A conta {conta} foi entregue no seu e-mail (pedido {pedido}). Qualquer dúvida na troca de nome, @ ou foto, me chama aqui.",
  crm_follow_up: "Oi, {nome}! Aqui é da {loja}. Passando para saber se você ainda procura uma conta. Chegaram opções novas.",
  customer_hello: "Olá, {nome}! Aqui é da {loja}.",
  account_offer: [
    "Oi, {nome}! Separei essa conta do {rede} para você:",
    "",
    "*{conta}*",
    "{detalhes}",
    "",
    "Valor: *{valor}*",
    "Ver fotos e comprar: {link}",
    "",
    "Qualquer dúvida, me chama aqui. {loja}",
  ].join("\n"),
};

export const MAX_TEMPLATE_LENGTH = 1000;

/** Troca `{nome}`, `{pedido}`... pelos valores. Variável sem valor fica como está, para o Jota perceber. */
export function fillTemplate(body: string, values: TemplateValues): string {
  return body.replace(/\{(\w+)\}/g, (match, name: string) => values[name as TemplateVariable] ?? match);
}
