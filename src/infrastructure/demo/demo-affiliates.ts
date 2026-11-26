import type {
  AffiliateAdminRepository,
  AffiliateAuthState,
  AffiliatePortalService,
  AffiliateProfileUpdate,
  AffiliateSignupResult,
  AffiliateTrackingService,
  TrackedClick,
} from "@/application/affiliate-ports";
import { sha256Hex } from "@/application/affiliate-use-cases";
import {
  AFFILIATE_SIGNUP_MESSAGE,
  DEFAULT_ACCOUNT_AFFILIATE_RULE,
  DEFAULT_AFFILIATE_PROGRAM,
  affiliateAmountFor,
  type AccountAffiliateRule,
  type AccountCommissions,
  type Affiliate,
  type AffiliateAnnouncement,
  type AffiliateAnnouncementData,
  type AffiliateClick,
  type AffiliateCommission,
  type AffiliateCoupon,
  type AffiliateMe,
  type AffiliateProgram,
  type AffiliateProgramData,
  type AffiliateSignup,
  type AffiliateStatusChange,
  type CommissionRule,
  type CommissionVia,
  type RankingEntry,
  publicAffiliateName,
} from "@/domain/affiliate";
import {
  bestCommissionRule,
  sortCommissionRules,
  type AffiliateCommissionRule,
  type CommissionRuleData,
  type CommissionRuleOwner,
  type MyCommissionRule,
} from "@/domain/affiliate-commission-rules";
import type { AffiliateInvite, AffiliateInviteData, AffiliateInvitePreview } from "@/domain/affiliate-invite";
import {
  ASSIGN_ORDER_MESSAGE,
  BALANCE_COUPON_MESSAGE,
  GIFT_ERROR_MESSAGE,
  MIN_BALANCE_COUPON_CENTS,
  PAYOUT_REQUEST_MESSAGE,
  canRequestPayout,
  payoutStatusOf,
  type AffiliateBalanceCoupon,
  type AffiliateGift,
  type AffiliateGiftClaim,
  type AffiliateGiftData,
  type AffiliatePayout,
  type AffiliateStoreStats,
  type AffiliateWhatsAppLead,
} from "@/domain/affiliate-rewards";
import { CouponCodeTakenError, InvalidCredentialsError } from "@/domain/errors";
import { isCartMember, type Order } from "@/domain/order";
import { stockCategoryOf } from "@/domain/stock";
import type { StoredCoupon } from "./demo-coupons";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";

/** Afiliado no navegador: a senha fica guardada aberta porque é só demonstração. */
interface DemoAffiliate extends Affiliate {
  password: string;
  document: string | null;
}

/** Venda que chegou por link ou cupom: a comissão sai do pedido, como o gatilho do banco faz. */
interface DemoOrderLink {
  orderCode: string;
  affiliateId: string;
  via: CommissionVia;
  canceledManually?: boolean;
}

export interface DemoAffiliateState {
  program: AffiliateProgram;
  affiliates: DemoAffiliate[];
  clicks: (AffiliateClick & { id: string })[];
  orderLinks: DemoOrderLink[];
  /** Comissões de exemplo, para o painel não abrir vazio. */
  seededCommissions: AffiliateCommission[];
  announcements: AffiliateAnnouncement[];
  accountRules: Record<string, AccountAffiliateRule>;
  /** Código do cupom -> afiliado dono. */
  couponOwners: Record<string, string>;
  sessionEmail: string | null;
  payouts: AffiliatePayout[];
  /** Comissão paga -> lote. Vale também para as que nascem dos pedidos. */
  paidCommissions: Record<string, string>;
  gifts: AffiliateGift[];
  giftClaims: AffiliateGiftClaim[];
  whatsappLeads: AffiliateWhatsAppLead[];
  /** Entrega 3: regras de comissão, convites e comissões reservadas em código de saldo (id da comissão -> código). */
  commissionRules: AffiliateCommissionRule[];
  invites: AffiliateInvite[];
  balanceReservations: Record<string, string>;
}

/** Código de convite da demonstração: /seja-afiliado?convite=demoConviteGimena2026xy */
export const DEMO_INVITE_TOKEN = "demoConviteGimena2026xy";

/** Igual à regra que a migration cria: Shop piloto paga R$ 20 para todo afiliado. */
const seedRules = (): AffiliateCommissionRule[] => [
  {
    id: "rule_demo_pilot",
    affiliateId: null,
    inviteId: null,
    category: "shop_pilot",
    minFollowers: null,
    commission: { kind: "fixed", value: 2000 },
    createdAt: new Date(0).toISOString(),
  },
  {
    id: "rule_demo_gimena",
    affiliateId: null,
    inviteId: "inv_demo_gimena",
    category: null,
    minFollowers: 2000,
    commission: { kind: "fixed", value: 4000 },
    createdAt: new Date(0).toISOString(),
  },
];

const seedInvites = (): AffiliateInvite[] => [
  {
    id: "inv_demo_gimena",
    token: DEMO_INVITE_TOKEN,
    name: "Gimena Alves",
    whatsapp: "84999991111",
    email: "gimena@exemplo.com",
    commission: null,
    note: "Combinado: R$ 40 por venda em contas a partir de 2.000 seguidores.",
    status: "pending",
    claimedAffiliateId: null,
    createdAt: new Date(Date.now() - 86_400_000).toISOString(),
  },
];

export const DEMO_AFFILIATE_LOGIN = { email: "ana@exemplo.com", password: "afiliado123" } as const;

const DEMO_TERMS =
  "Termos de exemplo do programa de afiliados.\n\n1. A comissão vale só para vendas pagas.\n2. Ela é liberada depois do fim da garantia.\n3. Compra feita por você mesmo não gera comissão.";

const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

function seed(): DemoAffiliateState {
  const ana: DemoAffiliate = {
    id: "aff_demo_ana",
    code: "ana3f1",
    name: "Ana Souza",
    email: DEMO_AFFILIATE_LOGIN.email,
    whatsapp: "84999990000",
    pixKey: "ana@exemplo.com",
    status: "approved",
    statusNote: null,
    partnerId: null,
    commission: null,
    notificationsSeenAt: daysAgo(3),
    payoutRequestedAt: null,
    termsAcceptedAt: daysAgo(40),
    approvedAt: daysAgo(39),
    createdAt: daysAgo(40),
    password: DEMO_AFFILIATE_LOGIN.password,
    document: "52998224725",
  };
  const bruno: DemoAffiliate = {
    ...ana,
    id: "aff_demo_bruno",
    code: "bruno7c2",
    name: "Bruno Lima",
    email: "bruno@exemplo.com",
    pixKey: null,
    status: "pending",
    approvedAt: null,
    termsAcceptedAt: daysAgo(1),
    createdAt: daysAgo(1),
    document: null,
  };
  const commission = (id: string, days: number, amount: number, status: AffiliateCommission["status"], releaseInDays: number | null): AffiliateCommission => ({
    id,
    affiliateId: ana.id,
    orderCode: `JD-DEMO${id.slice(-2).toUpperCase()}`,
    via: "link",
    accountHandle: "@achadinhos.dabia",
    accountPlatform: "tiktok",
    base: amount * 10,
    amount,
    status,
    releaseAt: releaseInDays === null ? null : new Date(Date.now() + releaseInDays * 86_400_000).toISOString(),
    canceledReason: status === "canceled" ? "order_canceled" : null,
    payoutId: null,
    balanceCouponId: null,
    createdAt: daysAgo(days),
  });
  return {
    program: { ...DEFAULT_AFFILIATE_PROGRAM, enabled: true, terms: DEMO_TERMS, updatedAt: daysAgo(40) },
    affiliates: [ana, bruno],
    clicks: Array.from({ length: 24 }, (_, index) => ({ id: `clk_${index}`, affiliateId: ana.id, accountId: null, createdAt: daysAgo(index) })),
    orderLinks: [],
    seededCommissions: [
      ...Array.from({ length: 10 }, (_, index) => ({
        ...commission(`p${String(index).padStart(2, "0")}`, 60 - index * 2, 4500, "paid", -20),
        payoutId: "pay_demo_1",
      })),
      commission("c01", 20, 3700, "pending", -5),
      commission("c06", 16, 2000, "pending", -2),
      commission("c02", 6, 4500, "pending", 9),
      commission("c03", 2, 2900, "pending", null),
      commission("c05", 1, 4500, "pending", null),
      commission("c04", 12, 3100, "canceled", null),
    ],
    announcements: [
      { id: "ann_demo", title: "Bem-vindo ao programa", body: "Use o seu link em cada conta da vitrine. A comissão entra quando o cliente paga.", pinned: true, createdAt: daysAgo(30) },
    ],
    accountRules: {},
    couponOwners: {},
    sessionEmail: null,
    payouts: [
      { id: "pay_demo_1", affiliateId: ana.id, commissionsCount: 10, amount: 45000, pixKey: ana.pixKey, note: "Pix de outubro", usedInPurchase: false, paidAt: daysAgo(10) },
    ],
    paidCommissions: {},
    gifts: [
      {
        id: "gift_demo_1",
        title: "Aula bônus de TikTok Shop",
        description: "Videoaula de como cadastrar produtos no TikTok Shop, para você indicar com mais segurança.",
        affiliateId: null,
        expiresAt: new Date(Date.now() + 15 * 86_400_000).toISOString(),
        active: true,
        createdAt: daysAgo(1),
      },
    ],
    giftClaims: [],
    whatsappLeads: [{ affiliateId: ana.id, createdAt: daysAgo(2) }],
    commissionRules: seedRules(),
    invites: seedInvites(),
    balanceReservations: {},
  };
}

/** Estado salvo no navegador antes da entrega 2 ganha os campos novos sem perder o resto. */
function stateOf(state: DemoState): DemoAffiliateState {
  const affiliates = (state.affiliateProgram ??= seed());
  // Antes da entrega 3 o número de vendas do exemplo era o lote de pagamento (payoutBatchSize).
  const legacy: Partial<AffiliateProgram> & { payoutBatchSize?: number } = affiliates.program;
  affiliates.program = {
    ...DEFAULT_AFFILIATE_PROGRAM,
    ...affiliates.program,
    incentiveSales: legacy.incentiveSales ?? legacy.payoutBatchSize ?? DEFAULT_AFFILIATE_PROGRAM.incentiveSales,
    texts: { ...DEFAULT_AFFILIATE_PROGRAM.texts, ...legacy.texts },
  };
  affiliates.commissionRules ??= seedRules();
  affiliates.invites ??= seedInvites();
  affiliates.balanceReservations ??= {};
  for (const affiliate of affiliates.affiliates) affiliate.payoutRequestedAt ??= null;
  for (const commission of affiliates.seededCommissions) commission.balanceCouponId ??= null;
  affiliates.payouts ??= [];
  affiliates.paidCommissions ??= {};
  affiliates.gifts ??= [];
  affiliates.giftClaims ??= [];
  affiliates.whatsappLeads ??= [];
  return affiliates;
}

const publicAffiliate = ({ password: _password, document: _document, ...affiliate }: DemoAffiliate): Affiliate => ({
  ...affiliate,
  commission: affiliate.commission ?? null,
  notificationsSeenAt: affiliate.notificationsSeenAt ?? null,
  payoutRequestedAt: affiliate.payoutRequestedAt ?? null,
});

const affiliateRuleOf = (affiliates: DemoAffiliateState, affiliateId: string) =>
  affiliates.affiliates.find((item) => item.id === affiliateId)?.commission ?? null;

const ruleOf = (affiliates: DemoAffiliateState, accountId: string) => affiliates.accountRules[accountId] ?? DEFAULT_ACCOUNT_AFFILIATE_RULE;

/** Igual a `affiliate_amount_for`: regra personalizada que casa, comissão do afiliado, da conta ou a padrão. */
function amountFor(state: DemoState, affiliateId: string, accountId: string | null, base: number): number {
  const affiliates = stateOf(state);
  const account = accountId ? state.accounts.find((item) => item.id === accountId) : undefined;
  const matched = account ? bestCommissionRule(affiliates.commissionRules, affiliateId, { category: stockCategoryOf(account), followers: account.followers }) : null;
  return affiliateAmountFor(
    {
      program: affiliates.program.commission,
      affiliate: affiliateRuleOf(affiliates, affiliateId),
      account: accountId ? ruleOf(affiliates, accountId).commission : null,
      matchedRule: matched?.commission ?? null,
    },
    base,
  );
}

const PURCHASE_PAYOUT_PREFIX = "pay_saldo_";

const balanceCouponsOf = (state: DemoState): StoredCoupon[] => (state.coupons ?? []).filter((coupon) => Boolean(coupon.affiliateBalanceOf));

const isLeadOrder = (order: Order) => !isCartMember({ code: order.code, cartCode: order.cartCode ?? null });

/** Pedido pago com o código de saldo (o saldo foi usado). */
const purchaseWith = (state: DemoState, code: string): Order | undefined =>
  state.orders.find((order) => order.couponCode === code && isLeadOrder(order) && (order.status === "paid" || order.status === "delivered"));

const openOrderWith = (state: DemoState, code: string): boolean =>
  state.orders.some((order) => order.couponCode === code && isLeadOrder(order) && order.status !== "canceled");

/** Reserva em código de saldo e, se o pedido com o código foi pago, a comissão vira paga (como o gatilho do banco). */
function withBalance(state: DemoState, commission: AffiliateCommission): AffiliateCommission {
  const code = stateOf(state).balanceReservations[commission.id];
  const coupon = code ? balanceCouponsOf(state).find((item) => item.code === code) : undefined;
  if (!coupon || commission.status === "canceled") return { ...commission, balanceCouponId: null };
  if (commission.status === "pending" && purchaseWith(state, coupon.code)) {
    return { ...commission, status: "paid", payoutId: `${PURCHASE_PAYOUT_PREFIX}${coupon.id}`, balanceCouponId: coupon.id };
  }
  return { ...commission, balanceCouponId: coupon.active && commission.status === "pending" ? coupon.id : null };
}

/** Pagamentos "Usado na compra" que nascem dos pedidos pagos com código de saldo. */
function purchasePayouts(state: DemoState, commissions: readonly AffiliateCommission[]): AffiliatePayout[] {
  return balanceCouponsOf(state).flatMap((coupon): AffiliatePayout[] => {
    const order = purchaseWith(state, coupon.code);
    const used = commissions.filter((commission) => commission.payoutId === `${PURCHASE_PAYOUT_PREFIX}${coupon.id}`);
    if (!order || used.length === 0 || !coupon.affiliateBalanceOf) return [];
    return [
      {
        id: `${PURCHASE_PAYOUT_PREFIX}${coupon.id}`,
        affiliateId: coupon.affiliateBalanceOf,
        commissionsCount: used.length,
        amount: used.reduce((total, commission) => total + commission.amount, 0),
        pixKey: null,
        note: `Usado na compra ${order.code}`,
        usedInPurchase: true,
        paidAt: order.createdAt,
      },
    ];
  });
}

function allPayouts(state: DemoState): AffiliatePayout[] {
  return [...stateOf(state).payouts, ...purchasePayouts(state, derivedCommissions(state))].sort((a, b) => b.paidAt.localeCompare(a.paidAt));
}

/** Código de saldo valendo do afiliado: ligado e ainda não usado numa compra paga. */
function activeBalanceCoupon(state: DemoState, affiliateId: string): StoredCoupon | undefined {
  return balanceCouponsOf(state)
    .filter((coupon) => coupon.affiliateBalanceOf === affiliateId && coupon.active && !purchaseWith(state, coupon.code))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
}

const toBalanceCoupon = (state: DemoState, coupon: StoredCoupon): AffiliateBalanceCoupon => ({
  code: coupon.code,
  value: coupon.value,
  inUse: openOrderWith(state, coupon.code),
});

/** Comissão reservada cancelada: desliga o código de saldo sem uso e solta o resto, como o gatilho do banco. */
function releaseReservation(state: DemoState, commissionId: string): void {
  const affiliates = stateOf(state);
  const code = affiliates.balanceReservations[commissionId];
  if (!code) return;
  delete affiliates.balanceReservations[commissionId];
  const coupon = balanceCouponsOf(state).find((item) => item.code === code);
  if (!coupon || openOrderWith(state, code)) return;
  coupon.active = false;
  for (const [otherId, otherCode] of Object.entries(affiliates.balanceReservations)) {
    if (otherCode === code) delete affiliates.balanceReservations[otherId];
  }
}

/** Comissões dos pedidos ligados, com a mesma regra do gatilho do banco. */
function derivedCommissions(state: DemoState): AffiliateCommission[] {
  const affiliates = stateOf(state);
  const guaranteeDays = state.settings?.guaranteeDays ?? 7;
  const fromOrders = affiliates.orderLinks.flatMap((link): AffiliateCommission[] => {
    const order = state.orders.find((item) => item.code === link.orderCode);
    if (!order || order.status === "awaiting_payment") return [];
    const rule = order.accountId ? ruleOf(affiliates, order.accountId) : DEFAULT_ACCOUNT_AFFILIATE_RULE;
    if (!rule.enabled) return [];
    const amount = amountFor(state, link.affiliateId, order.accountId, order.total);
    const canceled = order.status === "canceled" || link.canceledManually === true;
    const id = `com_${order.code}`;
    const payoutId = affiliates.paidCommissions[id] ?? null;
    return [
      {
        id,
        affiliateId: link.affiliateId,
        orderCode: order.code,
        via: link.via,
        accountHandle: order.accountHandle,
        accountPlatform: order.accountPlatform,
        base: order.total,
        amount,
        status: canceled ? "canceled" : payoutId ? "paid" : "pending",
        releaseAt: order.deliveredAt ? new Date(Date.parse(order.deliveredAt) + guaranteeDays * 86_400_000).toISOString() : null,
        canceledReason: canceled ? (link.canceledManually ? "manual" : "order_canceled") : null,
        payoutId,
        balanceCouponId: null,
        createdAt: order.createdAt,
      },
    ];
  });
  return [...fromOrders, ...affiliates.seededCommissions]
    .map((commission) => withBalance(state, commission))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function accountCommissionsFor(state: DemoState, affiliateId: string): AccountCommissions {
  const affiliates = stateOf(state);
  if (!affiliates.program.enabled) return new Map();
  return new Map(
    state.accounts
      .filter((account) => account.status !== "sold" && ruleOf(affiliates, account.id).enabled)
      .map((account) => [account.id, amountFor(state, affiliateId, account.id, account.price)]),
  );
}

/** Igual a `affiliate_store_stats`: afiliados aprovados e contas vendidas no período. */
function storeStatsOf(state: DemoState, days: number): AffiliateStoreStats {
  const since = Date.now() - days * 86_400_000;
  const sold = state.orders.filter(
    (order) => order.accountId && (order.status === "paid" || order.status === "delivered") && Date.parse(order.createdAt) >= since,
  );
  return {
    approvedAffiliates: stateOf(state).affiliates.filter((item) => item.status === "approved").length,
    soldAccountIds: [...new Set(sold.flatMap((order) => (order.accountId ? [order.accountId] : [])))],
  };
}

function rankingOf(state: DemoState, meId: string | null): RankingEntry[] {
  const affiliates = stateOf(state);
  const since = Date.now() - 30 * 86_400_000;
  const sales = new Map<string, number>();
  for (const commission of derivedCommissions(state)) {
    if (commission.status === "canceled" || Date.parse(commission.createdAt) < since) continue;
    sales.set(commission.affiliateId, (sales.get(commission.affiliateId) ?? 0) + 1);
  }
  return [...sales.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([affiliateId, count], index) => ({
      rank: index + 1,
      displayName: publicAffiliateName(affiliates.affiliates.find((item) => item.id === affiliateId)?.name ?? "Afiliado"),
      sales: count,
      isMe: affiliateId === meId,
    }));
}

export class DemoAffiliateAdminRepository implements AffiliateAdminRepository {
  constructor(private readonly db: DemoDatabase) {}

  async getProgram(): Promise<AffiliateProgram> {
    return stateOf(this.db.read()).program;
  }

  async saveProgram(data: AffiliateProgramData): Promise<AffiliateProgram> {
    await simulateLatency();
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      affiliates.program = { ...data, updatedAt: new Date().toISOString() };
      return affiliates.program;
    });
  }

  async listAffiliates(): Promise<Affiliate[]> {
    return stateOf(this.db.read()).affiliates.map(publicAffiliate).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findAffiliate(id: string): Promise<Affiliate | null> {
    const found = stateOf(this.db.read()).affiliates.find((item) => item.id === id);
    return found ? publicAffiliate(found) : null;
  }

  async documentOf(id: string): Promise<string | null> {
    return stateOf(this.db.read()).affiliates.find((item) => item.id === id)?.document ?? null;
  }

  async changeStatus(id: string, change: AffiliateStatusChange): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      for (const affiliate of stateOf(state).affiliates) {
        if (affiliate.id !== id) continue;
        if (change.status === "approved" && affiliate.status !== "approved") affiliate.approvedAt = new Date().toISOString();
        affiliate.status = change.status;
        affiliate.statusNote = change.statusNote;
      }
    });
  }

  async linkPartner(id: string, partnerId: string | null): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliate = stateOf(state).affiliates.find((item) => item.id === id);
      if (affiliate) affiliate.partnerId = partnerId;
    });
  }

  async removeAffiliate(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliates = stateOf(state);
      affiliates.affiliates = affiliates.affiliates.filter((item) => item.id !== id);
      affiliates.orderLinks = affiliates.orderLinks.filter((link) => link.affiliateId !== id);
      affiliates.seededCommissions = affiliates.seededCommissions.filter((commission) => commission.affiliateId !== id);
    });
  }

  async listCommissions(): Promise<AffiliateCommission[]> {
    return derivedCommissions(this.db.read());
  }

  async cancelCommission(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliates = stateOf(state);
      releaseReservation(state, id);
      const seeded = affiliates.seededCommissions.find((commission) => commission.id === id);
      if (seeded) {
        seeded.status = "canceled";
        seeded.canceledReason = "manual";
        return;
      }
      const link = affiliates.orderLinks.find((item) => `com_${item.orderCode}` === id);
      if (link) link.canceledManually = true;
    });
  }

  async listClicks(): Promise<AffiliateClick[]> {
    return stateOf(this.db.read()).clicks;
  }

  async listCoupons(affiliateId: string): Promise<AffiliateCoupon[]> {
    const state = this.db.read();
    const owners = stateOf(state).couponOwners;
    return (state.coupons ?? [])
      .filter((coupon) => owners[coupon.code] === affiliateId)
      .map((coupon) => ({ code: coupon.code, kind: coupon.kind, value: coupon.value }));
  }

  async createCoupon(affiliateId: string, coupon: AffiliateCoupon): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const all = state.coupons ?? [];
      if (all.some((item) => item.code === coupon.code)) throw new CouponCodeTakenError(coupon.code);
      state.coupons = [
        ...all,
        { ...coupon, id: newId("cpn"), active: true, startsAt: null, endsAt: null, maxUses: null, notes: "Cupom de afiliado", createdAt: new Date().toISOString() },
      ];
      stateOf(state).couponOwners[coupon.code] = affiliateId;
    });
  }

  async listAnnouncements(): Promise<AffiliateAnnouncement[]> {
    return stateOf(this.db.read()).announcements;
  }

  async saveAnnouncement(id: string | null, data: AffiliateAnnouncementData): Promise<AffiliateAnnouncement> {
    await simulateLatency();
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const current = id ? affiliates.announcements.find((item) => item.id === id) : undefined;
      const saved: AffiliateAnnouncement = { id: current?.id ?? newId("ann"), createdAt: current?.createdAt ?? new Date().toISOString(), ...data };
      affiliates.announcements = current ? affiliates.announcements.map((item) => (item.id === id ? saved : item)) : [saved, ...affiliates.announcements];
      return saved;
    });
  }

  async removeAnnouncement(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliates = stateOf(state);
      affiliates.announcements = affiliates.announcements.filter((item) => item.id !== id);
    });
  }

  async getAccountRule(accountId: string): Promise<AccountAffiliateRule> {
    return ruleOf(stateOf(this.db.read()), accountId);
  }

  async listAccountRules(): Promise<ReadonlyMap<string, AccountAffiliateRule>> {
    return new Map(Object.entries(stateOf(this.db.read()).accountRules));
  }

  async saveAccountRule(accountId: string, rule: AccountAffiliateRule): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      stateOf(state).accountRules[accountId] = rule;
    });
  }

  async saveAffiliateCommission(id: string, rule: CommissionRule | null): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliate = stateOf(state).affiliates.find((item) => item.id === id);
      if (affiliate) affiliate.commission = rule;
    });
  }

  async listPayouts(): Promise<AffiliatePayout[]> {
    return allPayouts(this.db.read());
  }

  async payCommissions(affiliateId: string, commissionIds: readonly string[], note: string | null): Promise<string> {
    await simulateLatency();
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const picked = derivedCommissions(state).filter(
        (commission) =>
          commissionIds.includes(commission.id) && commission.affiliateId === affiliateId && commission.status === "pending" && commission.balanceCouponId === null,
      );
      if (picked.length === 0 || picked.length !== commissionIds.length) {
        throw new Error("Alguma dessas comissões já foi paga, cancelada ou virou código de saldo. Atualize a página e tente de novo.");
      }
      const owner = affiliates.affiliates.find((item) => item.id === affiliateId);
      if (owner) owner.payoutRequestedAt = null;
      const payout: AffiliatePayout = {
        id: newId("pay"),
        affiliateId,
        commissionsCount: picked.length,
        amount: picked.reduce((total, commission) => total + commission.amount, 0),
        pixKey: owner?.pixKey ?? null,
        note,
        usedInPurchase: false,
        paidAt: new Date().toISOString(),
      };
      affiliates.payouts.push(payout);
      for (const commission of picked) {
        const seeded = affiliates.seededCommissions.find((item) => item.id === commission.id);
        if (seeded) {
          seeded.status = "paid";
          seeded.payoutId = payout.id;
        } else {
          affiliates.paidCommissions[commission.id] = payout.id;
        }
      }
      return payout.id;
    });
  }

  async undoPayout(payoutId: string): Promise<void> {
    await simulateLatency();
    if (payoutId.startsWith(PURCHASE_PAYOUT_PREFIX)) throw new Error("Saldo usado numa compra não se desfaz por aqui.");
    this.db.write((state) => {
      const affiliates = stateOf(state);
      affiliates.payouts = affiliates.payouts.filter((payout) => payout.id !== payoutId);
      for (const seeded of affiliates.seededCommissions) {
        if (seeded.payoutId !== payoutId) continue;
        seeded.status = "pending";
        seeded.payoutId = null;
      }
      for (const [commissionId, paidIn] of Object.entries(affiliates.paidCommissions)) {
        if (paidIn === payoutId) delete affiliates.paidCommissions[commissionId];
      }
    });
  }

  async listGifts(): Promise<AffiliateGift[]> {
    return [...stateOf(this.db.read()).gifts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async saveGift(id: string | null, data: AffiliateGiftData): Promise<AffiliateGift> {
    await simulateLatency();
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const existing = id ? affiliates.gifts.find((gift) => gift.id === id) : undefined;
      if (existing) {
        Object.assign(existing, data);
        return { ...existing };
      }
      const created: AffiliateGift = { ...data, id: newId("gift"), createdAt: new Date().toISOString() };
      affiliates.gifts.push(created);
      return created;
    });
  }

  async removeGift(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliates = stateOf(state);
      affiliates.gifts = affiliates.gifts.filter((gift) => gift.id !== id);
      affiliates.giftClaims = affiliates.giftClaims.filter((claim) => claim.giftId !== id);
    });
  }

  async listGiftClaims(): Promise<AffiliateGiftClaim[]> {
    return stateOf(this.db.read()).giftClaims;
  }

  async setGiftDelivered(giftId: string, affiliateId: string, delivered: boolean): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const claim = stateOf(state).giftClaims.find((item) => item.giftId === giftId && item.affiliateId === affiliateId);
      if (claim) claim.deliveredAt = delivered ? new Date().toISOString() : null;
    });
  }

  async assignOrder(orderCode: string, affiliateId: string): Promise<number> {
    await simulateLatency();
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      if (!affiliates.affiliates.some((item) => item.id === affiliateId && item.status === "approved")) {
        throw new Error(ASSIGN_ORDER_MESSAGE.affiliate_not_approved);
      }
      const orders = state.orders.filter((order) => order.code === orderCode || order.cartCode === orderCode);
      if (orders.length === 0) throw new Error(ASSIGN_ORDER_MESSAGE.order_not_found);
      if (orders.some((order) => order.status === "canceled")) throw new Error(ASSIGN_ORDER_MESSAGE.order_canceled);
      if (orders.some((order) => affiliates.orderLinks.some((link) => link.orderCode === order.code))) {
        throw new Error(ASSIGN_ORDER_MESSAGE.order_has_affiliate);
      }
      for (const order of orders) affiliates.orderLinks.push({ orderCode: order.code, affiliateId, via: "manual" });
      return orders.filter((order) => order.status === "paid" || order.status === "delivered").length;
    });
  }

  async listWhatsAppLeads(): Promise<AffiliateWhatsAppLead[]> {
    return stateOf(this.db.read()).whatsappLeads;
  }

  async storeStats(days: number): Promise<AffiliateStoreStats> {
    return storeStatsOf(this.db.read(), days);
  }

  async listCommissionRules(): Promise<AffiliateCommissionRule[]> {
    return sortCommissionRules(stateOf(this.db.read()).commissionRules);
  }

  async saveCommissionRule(id: string | null, owner: CommissionRuleOwner, data: CommissionRuleData): Promise<AffiliateCommissionRule> {
    await simulateLatency();
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const existing = id ? affiliates.commissionRules.find((rule) => rule.id === id) : undefined;
      if (existing) {
        Object.assign(existing, data);
        return { ...existing };
      }
      const created: AffiliateCommissionRule = {
        ...data,
        id: newId("rule"),
        affiliateId: owner.kind === "affiliate" ? owner.affiliateId : null,
        inviteId: owner.kind === "invite" ? owner.inviteId : null,
        createdAt: new Date().toISOString(),
      };
      affiliates.commissionRules.push(created);
      return created;
    });
  }

  async removeCommissionRule(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliates = stateOf(state);
      affiliates.commissionRules = affiliates.commissionRules.filter((rule) => rule.id !== id);
    });
  }

  async listInvites(): Promise<AffiliateInvite[]> {
    return [...stateOf(this.db.read()).invites].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async createInvite(data: AffiliateInviteData): Promise<AffiliateInvite> {
    await simulateLatency();
    return this.db.write((state) => {
      const token = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
      const created: AffiliateInvite = { ...data, id: newId("inv"), token, status: "pending", claimedAffiliateId: null, createdAt: new Date().toISOString() };
      stateOf(state).invites.push(created);
      return created;
    });
  }

  async updateInvite(id: string, data: AffiliateInviteData): Promise<AffiliateInvite> {
    await simulateLatency();
    return this.db.write((state) => {
      const invite = stateOf(state).invites.find((item) => item.id === id && item.status !== "claimed");
      if (!invite) throw new Error("Esse convite já foi aceito e não muda mais.");
      Object.assign(invite, data);
      return { ...invite };
    });
  }

  async revokeInvite(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const invite = stateOf(state).invites.find((item) => item.id === id && item.status === "pending");
      if (invite) invite.status = "revoked";
    });
  }
}

/** Login de demonstração: ana@exemplo.com / afiliado123 (ou quem se cadastrar pelo "Seja afiliado"). */
export class DemoAffiliatePortalService implements AffiliatePortalService {
  private readonly listeners = new Set<(state: AffiliateAuthState) => void>();

  constructor(private readonly db: DemoDatabase) {}

  private me(state: DemoState): DemoAffiliate | null {
    const affiliates = stateOf(state);
    return affiliates.affiliates.find((item) => item.email === affiliates.sessionEmail) ?? null;
  }

  private approvedMe(state: DemoState): DemoAffiliate | null {
    const me = this.me(state);
    return me?.status === "approved" ? me : null;
  }

  private notify(state: AffiliateAuthState) {
    for (const listener of this.listeners) listener(state);
  }

  async getProgram(): Promise<AffiliateProgram> {
    return stateOf(this.db.read()).program;
  }

  async signUp(input: AffiliateSignup): Promise<AffiliateSignupResult> {
    await simulateLatency();
    const current = stateOf(this.db.read());
    const program = current.program;
    const pendingInvite = input.inviteToken ? current.invites.find((item) => item.token === input.inviteToken && item.status === "pending") : undefined;
    if (input.inviteToken && !pendingInvite) throw new Error(AFFILIATE_SIGNUP_MESSAGE.invalid_invite);
    if (!program.enabled && !pendingInvite) throw new Error(AFFILIATE_SIGNUP_MESSAGE.program_closed);
    if (input.termsSha256 !== (await sha256Hex(program.terms))) throw new Error(AFFILIATE_SIGNUP_MESSAGE.outdated_terms);
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const invite = pendingInvite ? affiliates.invites.find((item) => item.id === pendingInvite.id) : undefined;
      const approved = invite !== undefined || program.autoApprove;
      if (affiliates.affiliates.some((item) => item.email === input.email)) throw new Error(AFFILIATE_SIGNUP_MESSAGE.email_taken);
      if (affiliates.affiliates.some((item) => item.document === input.document)) throw new Error(AFFILIATE_SIGNUP_MESSAGE.document_taken);
      const now = new Date().toISOString();
      const base = input.name.split(" ")[0]?.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 12) || "afiliado";
      const created: DemoAffiliate = {
        id: newId("aff"),
        code: `${base}${crypto.randomUUID().slice(0, 3)}`,
        name: input.name,
        email: input.email,
        whatsapp: input.whatsapp,
        pixKey: null,
        status: approved ? "approved" : "pending",
        statusNote: null,
        partnerId: null,
        commission: invite?.commission ?? null,
        notificationsSeenAt: null,
        payoutRequestedAt: null,
        termsAcceptedAt: now,
        approvedAt: approved ? now : null,
        createdAt: now,
        password: input.password,
        document: input.document,
      };
      affiliates.affiliates.push(created);
      if (invite) {
        for (const rule of affiliates.commissionRules) {
          if (rule.inviteId !== invite.id) continue;
          rule.inviteId = null;
          rule.affiliateId = created.id;
        }
        invite.status = "claimed";
        invite.claimedAffiliateId = created.id;
      }
      return { status: created.status, code: created.code };
    });
  }

  async getAuthState(): Promise<AffiliateAuthState> {
    const email = stateOf(this.db.read()).sessionEmail;
    return email ? { status: "signed-in", email } : { status: "signed-out" };
  }

  onAuthChange(listener: (state: AffiliateAuthState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async signIn(email: string, password: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const affiliates = stateOf(state);
      const found = affiliates.affiliates.find((item) => item.email === email && item.password === password);
      if (!found) throw new InvalidCredentialsError();
      affiliates.sessionEmail = found.email;
    });
    this.notify({ status: "signed-in", email });
  }

  async signOut(): Promise<void> {
    this.db.write((state) => {
      stateOf(state).sessionEmail = null;
    });
    this.notify({ status: "signed-out" });
  }

  async requestPasswordReset(): Promise<void> {
    await simulateLatency();
  }

  async updatePassword(password: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const me = this.me(state);
      if (me) me.password = password;
    });
  }

  async loadMe(): Promise<AffiliateMe | null> {
    const state = this.db.read();
    const me = this.me(state);
    if (!me) return null;
    const owners = stateOf(state).couponOwners;
    const coupon = me.status === "approved" ? (state.coupons ?? []).find((item) => owners[item.code] === me.id && item.active) : undefined;
    return { ...publicAffiliate(me), coupon: coupon ? { code: coupon.code, kind: coupon.kind, value: coupon.value } : null };
  }

  async myDocument(): Promise<string | null> {
    return this.me(this.db.read())?.document ?? null;
  }

  async updateProfile(update: AffiliateProfileUpdate): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const me = this.me(state);
      if (!me) return;
      if (update.document && stateOf(state).affiliates.some((item) => item.id !== me.id && item.document === update.document)) {
        throw new Error(AFFILIATE_SIGNUP_MESSAGE.document_taken);
      }
      me.name = update.name;
      me.whatsapp = update.whatsapp;
      me.pixKey = update.pixKey;
      if (update.document) me.document = update.document;
    });
  }

  async listCommissions(): Promise<AffiliateCommission[]> {
    const state = this.db.read();
    const me = this.me(state);
    return me ? derivedCommissions(state).filter((commission) => commission.affiliateId === me.id) : [];
  }

  async listClicks(): Promise<AffiliateClick[]> {
    const state = this.db.read();
    const me = this.me(state);
    return me ? stateOf(state).clicks.filter((click) => click.affiliateId === me.id) : [];
  }

  async accountCommissions(): Promise<AccountCommissions> {
    const state = this.db.read();
    const me = this.approvedMe(state);
    return me ? accountCommissionsFor(state, me.id) : new Map();
  }

  async ranking(): Promise<RankingEntry[]> {
    const state = this.db.read();
    const me = this.approvedMe(state);
    return me ? rankingOf(state, me.id) : [];
  }

  async listAnnouncements(): Promise<AffiliateAnnouncement[]> {
    const state = this.db.read();
    return this.approvedMe(state) ? stateOf(state).announcements : [];
  }

  async listPayouts(): Promise<AffiliatePayout[]> {
    const state = this.db.read();
    const me = this.me(state);
    return me ? allPayouts(state).filter((payout) => payout.affiliateId === me.id) : [];
  }

  async listGifts(): Promise<AffiliateGift[]> {
    const state = this.db.read();
    const me = this.approvedMe(state);
    return me ? stateOf(state).gifts.filter((gift) => gift.active && (gift.affiliateId === null || gift.affiliateId === me.id)) : [];
  }

  async listGiftClaims(): Promise<AffiliateGiftClaim[]> {
    const state = this.db.read();
    const me = this.me(state);
    return me ? stateOf(state).giftClaims.filter((claim) => claim.affiliateId === me.id) : [];
  }

  async claimGift(giftId: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const me = this.approvedMe(state);
      const affiliates = stateOf(state);
      const gift = affiliates.gifts.find((item) => item.id === giftId && item.active && (item.affiliateId === null || item.affiliateId === me?.id));
      if (!me || !gift) throw new Error(GIFT_ERROR_MESSAGE.gift_not_found);
      if (gift.expiresAt && Date.parse(gift.expiresAt) <= Date.now()) throw new Error(GIFT_ERROR_MESSAGE.gift_expired);
      if (affiliates.giftClaims.some((claim) => claim.giftId === giftId && claim.affiliateId === me.id)) return;
      affiliates.giftClaims.push({ giftId, affiliateId: me.id, claimedAt: new Date().toISOString(), deliveredAt: null });
    });
  }

  async markNoticesSeen(): Promise<void> {
    this.db.write((state) => {
      const me = this.me(state);
      if (me) me.notificationsSeenAt = new Date().toISOString();
    });
  }

  async listWhatsAppLeads(): Promise<AffiliateWhatsAppLead[]> {
    const state = this.db.read();
    const me = this.me(state);
    return me ? stateOf(state).whatsappLeads.filter((lead) => lead.affiliateId === me.id) : [];
  }

  async storeStats(days: number): Promise<AffiliateStoreStats> {
    const state = this.db.read();
    return this.approvedMe(state) ? storeStatsOf(state, days) : { approvedAffiliates: 0, soldAccountIds: [] };
  }

  async invitePreview(token: string): Promise<AffiliateInvitePreview | null> {
    const invite = stateOf(this.db.read()).invites.find((item) => item.token === token && item.status === "pending");
    return invite ? { name: invite.name, whatsapp: invite.whatsapp, email: invite.email } : null;
  }

  async requestPayout(): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const me = this.approvedMe(state);
      if (!me) throw new Error(PAYOUT_REQUEST_MESSAGE.nothing_to_pay);
      const status = payoutStatusOf(
        derivedCommissions(state).filter((commission) => commission.affiliateId === me.id),
        me.payoutRequestedAt ?? null,
      );
      if (status.readyAmount <= 0) throw new Error(PAYOUT_REQUEST_MESSAGE.nothing_to_pay);
      if (!canRequestPayout(status)) throw new Error(PAYOUT_REQUEST_MESSAGE.payout_already_requested);
      me.payoutRequestedAt = new Date().toISOString();
    });
  }

  async myCommissionRules(): Promise<MyCommissionRule[]> {
    const state = this.db.read();
    const me = this.approvedMe(state);
    if (!me) return [];
    return sortCommissionRules(stateOf(state).commissionRules.filter((rule) => rule.inviteId === null && (rule.affiliateId === null || rule.affiliateId === me.id))).map(
      (rule) => ({ id: rule.id, mine: rule.affiliateId !== null, category: rule.category, minFollowers: rule.minFollowers, commission: rule.commission }),
    );
  }

  async myBalanceCoupon(): Promise<AffiliateBalanceCoupon | null> {
    const state = this.db.read();
    const me = this.approvedMe(state);
    const coupon = me ? activeBalanceCoupon(state, me.id) : undefined;
    return coupon ? toBalanceCoupon(state, coupon) : null;
  }

  async createBalanceCoupon(): Promise<AffiliateBalanceCoupon> {
    await simulateLatency();
    return this.db.write((state) => {
      const me = this.approvedMe(state);
      if (!me) throw new Error(BALANCE_COUPON_MESSAGE.balance_too_low);
      const existing = activeBalanceCoupon(state, me.id);
      if (existing) return toBalanceCoupon(state, existing);
      const ready = payoutStatusOf(derivedCommissions(state).filter((commission) => commission.affiliateId === me.id), null).ready;
      const total = ready.reduce((sum, commission) => sum + commission.amount, 0);
      if (total < MIN_BALANCE_COUPON_CENTS) throw new Error(BALANCE_COUPON_MESSAGE.balance_too_low);
      const code = `SALDO${me.code.toUpperCase()}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
      const coupon: StoredCoupon = {
        id: newId("cpn"),
        code,
        kind: "fixed",
        value: total,
        active: true,
        startsAt: null,
        endsAt: null,
        maxUses: 1,
        notes: `Saldo de comissão de ${me.name} (afiliado). Criado pelo painel do afiliado, vale uma compra.`,
        affiliateBalanceOf: me.id,
        createdAt: new Date().toISOString(),
      };
      state.coupons = [...(state.coupons ?? []), coupon];
      const affiliates = stateOf(state);
      for (const commission of ready) affiliates.balanceReservations[commission.id] = code;
      me.payoutRequestedAt = null;
      return toBalanceCoupon(state, coupon);
    });
  }

  async cancelBalanceCoupon(): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const me = this.approvedMe(state);
      const coupon = me ? activeBalanceCoupon(state, me.id) : undefined;
      if (!coupon) throw new Error(BALANCE_COUPON_MESSAGE.balance_coupon_not_found);
      if (openOrderWith(state, coupon.code)) throw new Error(BALANCE_COUPON_MESSAGE.balance_coupon_in_use);
      coupon.active = false;
      const affiliates = stateOf(state);
      for (const [commissionId, code] of Object.entries(affiliates.balanceReservations)) {
        if (code === coupon.code) delete affiliates.balanceReservations[commissionId];
      }
    });
  }
}

export class DemoAffiliateTrackingService implements AffiliateTrackingService {
  constructor(private readonly db: DemoDatabase) {}

  async track(code: string, accountSlug: string | null): Promise<TrackedClick | null> {
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const owner = affiliates.affiliates.find((item) => item.code === code && item.status === "approved");
      if (!affiliates.program.enabled || !owner) return null;
      const id = newId("clk");
      const accountId = state.accounts.find((account) => account.slug === accountSlug)?.id ?? null;
      affiliates.clicks.push({ id, affiliateId: owner.id, accountId, createdAt: new Date().toISOString() });
      return { clickId: id, linkDays: affiliates.program.linkDays };
    });
  }

  async attach(orderCode: string, clickId: string): Promise<boolean> {
    return this.db.write((state) => {
      const affiliates = stateOf(state);
      const click = affiliates.clicks.find((item) => item.id === clickId);
      if (!click || affiliates.orderLinks.some((link) => link.orderCode === orderCode)) return false;
      const orders = state.orders.filter((order) => order.code === orderCode || order.cartCode === orderCode);
      const lead = orders.find((order) => order.code === orderCode);
      const couponOwner = lead?.couponCode ? affiliates.couponOwners[lead.couponCode] : undefined;
      for (const order of orders) {
        affiliates.orderLinks.push({ orderCode: order.code, affiliateId: couponOwner ?? click.affiliateId, via: couponOwner ? "coupon" : "link" });
      }
      return orders.length > 0;
    });
  }
}
