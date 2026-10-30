import type { Cents } from "./money";

/**
 * Como o cliente escolheu pagar o pedido. Os dois últimos dividem o total em duas partes,
 * cada uma cobrada separada: cartão pela InfinitePay e Pix pelo C6 Bank (ou, sem o C6, na chave Nubank do Jota).
 */
export const PAYMENT_PLANS = ["pix", "card", "two_cards", "card_pix"] as const;
export type PaymentPlan = (typeof PAYMENT_PLANS)[number];

export const PAYMENT_PLAN_LABEL: Record<PaymentPlan, string> = {
  pix: "Pix",
  card: "Cartão de crédito",
  two_cards: "Dois cartões",
  card_pix: "Cartão + Pix",
};

export type PaymentPartMethod = "pix" | "card";

export const PAYMENT_PART_STATUSES = ["pending", "paid", "canceled"] as const;
export type PaymentPartStatus = (typeof PAYMENT_PART_STATUSES)[number];

/** Uma cobrança do pedido. Pedido com plano dividido tem duas; os outros, uma. */
export interface OrderPayment {
  id: string;
  /** 1 ou 2, na ordem em que aparecem para o cliente. */
  position: number;
  method: PaymentPartMethod;
  amount: Cents;
  status: PaymentPartStatus;
  /** Link do checkout da InfinitePay, criado quando o cliente vai pagar o cartão. */
  checkoutUrl: string | null;
  paidAt: string | null;
  /** Parcelas que o cliente escolheu no checkout (só no cartão único). Na InfinitePay ele escolhe de novo. */
  requestedInstallments: number | null;
  /** Comprovação do cartão, só no painel (a página pública do pedido não recebe): prova a venda numa contestação. */
  card: CardReceipt | null;
  /** Copia e cola da cobrança Pix do C6, enquanto a parte espera pagamento. Sem ele, o site usa a chave Nubank. */
  pixCode: string | null;
  /** Pix confirmado sozinho pelo C6, só no painel. Pix confirmado à mão pelo Jota não tem. */
  pix: PixReceipt | null;
}

export interface PixReceipt {
  /** Identificador do Pix no Banco Central (endToEndId): acha a transação no extrato do C6. */
  endToEndId: string;
  paidAmount: Cents | null;
}

export interface CardReceipt {
  /** Número da transação na InfinitePay (transaction_nsu). */
  transactionNsu: string;
  installments: number | null;
  paidAmount: Cents | null;
  receiptUrl: string | null;
}

/** Nenhuma parte da divisão pode ser menor que isso: cobrança de centavos não compensa a taxa. */
export const MIN_SPLIT_PART: Cents = 500;

export const isSplitPlan = (plan: PaymentPlan) => plan === "two_cards" || plan === "card_pix";

export type SplitCheck = { ok: true } | { ok: false; message: string };

/** Valor da primeira parte (sempre um cartão) dentro do que dá para dividir. */
export function checkSplit(total: Cents, firstPart: Cents | null): SplitCheck {
  if (firstPart === null) return { ok: false, message: "Informe quanto vai no primeiro cartão." };
  if (total < MIN_SPLIT_PART * 2) return { ok: false, message: "Este valor é baixo demais para dividir." };
  if (firstPart < MIN_SPLIT_PART) return { ok: false, message: "Cada parte precisa ter pelo menos R$ 5,00." };
  if (total - firstPart < MIN_SPLIT_PART) return { ok: false, message: "Deixe pelo menos R$ 5,00 para a segunda parte." };
  return { ok: true };
}

export interface PlannedPart {
  method: PaymentPartMethod;
  amount: Cents;
}

/** Partes que o pedido vai cobrar. Mesma regra da função `place_order` no banco. */
export function planParts(plan: PaymentPlan, total: Cents, firstPart: Cents | null): PlannedPart[] {
  if (plan === "pix" || plan === "card") return [{ method: plan, amount: total }];
  const first = firstPart ?? Math.round(total / 2);
  return [
    { method: "card", amount: first },
    { method: plan === "two_cards" ? "card" : "pix", amount: total - first },
  ];
}

/** "Pix", "Cartão" ou, quando são dois cartões, "Cartão 1" e "Cartão 2". */
export function paymentPartLabel(part: Pick<OrderPayment, "method" | "position">, parts: readonly Pick<OrderPayment, "method">[]): string {
  if (part.method === "pix") return "Pix";
  return parts.filter((other) => other.method === "card").length > 1 ? `Cartão ${part.position}` : "Cartão";
}
