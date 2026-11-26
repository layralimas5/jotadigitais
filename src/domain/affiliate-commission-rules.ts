import { commissionRuleLabel, type CommissionRule } from "./affiliate";
import type { Cents } from "./money";
import { STOCK_CATEGORY_LABEL, type StockCategory } from "./stock";

/**
 * Regras de comissão personalizadas (entrega 3). Mesmas regras de `affiliate_commission_rules` e `affiliate_rule_for`
 * em supabase/migrations/20270103120000_affiliates_v3.sql.
 */

/** Para quem vale: todos os afiliados, um afiliado ou um convite (passa para o afiliado quando ele aceita). */
export type CommissionRuleOwner = { kind: "all" } | { kind: "affiliate"; affiliateId: string } | { kind: "invite"; inviteId: string };

export interface CommissionRuleData {
  /** Nulo = qualquer tipo de conta. */
  category: StockCategory | null;
  /** Só contas com pelo menos esses seguidores. Nulo = qualquer. */
  minFollowers: number | null;
  commission: CommissionRule;
}

export interface AffiliateCommissionRule extends CommissionRuleData {
  id: string;
  affiliateId: string | null;
  inviteId: string | null;
  createdAt: string;
}

export const MAX_RULE_MIN_FOLLOWERS = 1_000_000_000;

/** Frase da ordem de desempate, mostrada junto do editor. */
export const COMMISSION_RULE_PRECEDENCE =
  "Quando mais de uma regra serve, vale a do próprio afiliado, depois a que fala do tipo de conta, depois a de mais seguidores. Se a conta tiver comissão própria maior, vale a da conta.";

/** O que a regra precisa saber da conta. */
export interface RuleAccount {
  category: StockCategory;
  followers: number;
}

const matches = (rule: AffiliateCommissionRule, affiliateId: string, account: RuleAccount) =>
  rule.inviteId === null &&
  (rule.affiliateId === null || rule.affiliateId === affiliateId) &&
  (rule.category === null || rule.category === account.category) &&
  (rule.minFollowers === null || account.followers >= rule.minFollowers);

/** Ordem do banco: do afiliado primeiro, com tipo de conta, mais seguidores, mais nova. */
function compareRules(a: AffiliateCommissionRule, b: AffiliateCommissionRule): number {
  return (
    Number(b.affiliateId !== null) - Number(a.affiliateId !== null) ||
    Number(b.category !== null) - Number(a.category !== null) ||
    (b.minFollowers ?? -1) - (a.minFollowers ?? -1) ||
    b.createdAt.localeCompare(a.createdAt)
  );
}

/** A regra que vale para este afiliado nesta conta, igual a `affiliate_rule_for`. Nula quando nenhuma serve. */
export function bestCommissionRule(rules: readonly AffiliateCommissionRule[], affiliateId: string, account: RuleAccount): AffiliateCommissionRule | null {
  return [...rules].filter((rule) => matches(rule, affiliateId, account)).sort(compareRules)[0] ?? null;
}

/** Regras ordenadas como o banco desempata (para listar na tela). */
export const sortCommissionRules = <T extends AffiliateCommissionRule>(rules: readonly T[]): T[] => [...rules].sort(compareRules);

/** "Shop piloto, a partir de 2.000 seguidores: R$ 20,00 por venda". */
export function commissionRuleSummary(rule: CommissionRuleData, formatMoney: (cents: Cents) => string): string {
  const scope = [
    rule.category ? STOCK_CATEGORY_LABEL[rule.category] : "Qualquer conta",
    rule.minFollowers !== null ? `a partir de ${rule.minFollowers.toLocaleString("pt-BR")} seguidores` : null,
  ]
    .filter(Boolean)
    .join(", ");
  return `${scope}: ${commissionRuleLabel(rule.commission, formatMoney)}`;
}

/** Regra como o afiliado vê no painel (a dele ou a de todos). */
export interface MyCommissionRule extends CommissionRuleData {
  id: string;
  mine: boolean;
}
