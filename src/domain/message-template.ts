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

export const TEMPLATE_VARIABLES = ["nome", "pedido", "conta", "valor", "loja", "rede", "detalhes", "link", "email", "senha"] as const;

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
    when: "Pedido pago ou entregue: leva o e-mail e a senha da conta",
    variables: ["nome", "pedido", "conta", "email", "senha", "loja"],
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
  order_delivered: [
    "Pronto, {nome}! A conta {conta} é sua (pedido {pedido}).",
    "",
    "*E-mail:* {email}",
    "*Senha:* {senha}",
    "",
    "Assim que entrar, troque a senha e o e-mail para os seus. Qualquer dúvida na troca de nome, @ ou foto, me chama aqui.",
  ].join("\n"),
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

const ACCESS_VARIABLES = /\{(email|senha)\}/;

/**
 * Modelo de entrega com o login da conta. Sem e-mail cadastrado, as linhas de {email} e {senha} saem da mensagem
 * (e sem senha, só a linha da senha). Modelo personalizado antigo, sem essas variáveis, ganha o login no final.
 */
export function fillDeliveryTemplate(body: string, values: TemplateValues, access: { email: string; password: string | null } | null): string {
  const lines = body.split("\n").filter((line) => {
    if (!access) return !ACCESS_VARIABLES.test(line);
    return access.password !== null || !line.includes("{senha}");
  });
  const filled = fillTemplate(lines.join("\n"), { ...values, email: access?.email, senha: access?.password ?? undefined }).replace(/\n{3,}/g, "\n\n");
  if (!access || ACCESS_VARIABLES.test(body)) return filled;
  const block = [`*E-mail:* ${access.email}`, access.password ? `*Senha:* ${access.password}` : null].filter(Boolean).join("\n");
  return `${filled}\n\n${block}`;
}
