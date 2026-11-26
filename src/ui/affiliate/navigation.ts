import { Gift, House, Megaphone, ReceiptText, ShoppingBag, UserRound, Wallet, type LucideIcon } from "lucide-react";
import type { AffiliatePage } from "./session";

/**
 * Menu do painel do afiliado, no mesmo formato do painel da loja: grupos no menu lateral, quatro atalhos na barra de
 * baixo do celular e o resto no "Mais".
 */

export interface AffiliateNavItem {
  page: AffiliatePage;
  label: string;
  icon: LucideIcon;
  /** Linha de apoio na tela "Mais" do celular. */
  description: string;
}

export interface AffiliateNavGroup {
  label: string | null;
  items: readonly AffiliateNavItem[];
}

const HOME: AffiliateNavItem = { page: "", label: "Início", icon: House, description: "Resumo, saldo e avisos" };
const SHARE: AffiliateNavItem = { page: "divulgar", label: "Contas e links", icon: Megaphone, description: "Link de cada conta, QR Code e material" };
const STATEMENT: AffiliateNavItem = { page: "extrato", label: "Extrato", icon: ReceiptText, description: "Todas as vendas e comissões" };
const PAYOUTS: AffiliateNavItem = { page: "ganhos", label: "Pagamentos", icon: Wallet, description: "Saldo liberado e pedir pagamento" };
const BALANCE: AffiliateNavItem = { page: "saldo", label: "Comprar com saldo", icon: ShoppingBag, description: "Use o saldo numa conta do site" };
const GIFTS: AffiliateNavItem = { page: "brindes", label: "Brindes", icon: Gift, description: "Brindes da loja para você" };
const PROFILE: AffiliateNavItem = { page: "perfil", label: "Perfil", icon: UserRound, description: "Dados, CPF, chave Pix e senha" };

export const AFFILIATE_NAV_GROUPS: readonly AffiliateNavGroup[] = [
  { label: null, items: [HOME] },
  { label: "Divulgação", items: [SHARE] },
  { label: "Ganhos", items: [STATEMENT, PAYOUTS, BALANCE] },
  { label: "Brindes", items: [GIFTS] },
  { label: "Conta", items: [PROFILE] },
];

/** Atalhos da barra de baixo; o resto mora no "Mais". */
export const AFFILIATE_BOTTOM_NAV: readonly AffiliateNavItem[] = [HOME, { ...SHARE, label: "Divulgar" }, PAYOUTS, GIFTS];

export const AFFILIATE_MORE_ITEMS: readonly AffiliateNavItem[] = [STATEMENT, BALANCE, PROFILE];

/** "Ganhos › Extrato" para o topo. */
export function affiliateCrumbOf(page: string): { section: string; page: string } {
  if (page === "mais") return { section: "Painel", page: "Mais" };
  for (const group of AFFILIATE_NAV_GROUPS) {
    const item = group.items.find((entry) => entry.page === page);
    if (item) return { section: group.label ?? "Painel", page: item.label };
  }
  return { section: "Painel", page: "Início" };
}
