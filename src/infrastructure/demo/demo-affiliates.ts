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
  commissionCents,
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
  type RankingEntry,
  publicAffiliateName,
} from "@/domain/affiliate";
import { CouponCodeTakenError, InvalidCredentialsError } from "@/domain/errors";
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
  via: "link" | "coupon";
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
}

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
    createdAt: daysAgo(days),
  });
  return {
    program: { ...DEFAULT_AFFILIATE_PROGRAM, enabled: true, terms: DEMO_TERMS, updatedAt: daysAgo(40) },
    affiliates: [ana, bruno],
    clicks: Array.from({ length: 24 }, (_, index) => ({ id: `clk_${index}`, affiliateId: ana.id, accountId: null, createdAt: daysAgo(index) })),
    orderLinks: [],
    seededCommissions: [
      commission("c01", 20, 3700, "pending", -5),
      commission("c02", 6, 4500, "pending", 9),
      commission("c03", 2, 2900, "pending", null),
      commission("c04", 12, 3100, "canceled", null),
    ],
    announcements: [
      { id: "ann_demo", title: "Bem-vindo ao programa", body: "Use o seu link em cada conta da vitrine. A comissão entra quando o cliente paga.", pinned: true, createdAt: daysAgo(30) },
    ],
    accountRules: {},
    couponOwners: {},
    sessionEmail: null,
  };
}

const stateOf = (state: DemoState): DemoAffiliateState => (state.affiliateProgram ??= seed());

const publicAffiliate = ({ password: _password, document: _document, ...affiliate }: DemoAffiliate): Affiliate => affiliate;

const ruleOf = (affiliates: DemoAffiliateState, accountId: string) => affiliates.accountRules[accountId] ?? DEFAULT_ACCOUNT_AFFILIATE_RULE;

/** Comissões dos pedidos ligados, com a mesma regra do gatilho do banco. */
function derivedCommissions(state: DemoState): AffiliateCommission[] {
  const affiliates = stateOf(state);
  const guaranteeDays = state.settings?.guaranteeDays ?? 7;
  const fromOrders = affiliates.orderLinks.flatMap((link): AffiliateCommission[] => {
    const order = state.orders.find((item) => item.code === link.orderCode);
    if (!order || order.status === "awaiting_payment") return [];
    const rule = order.accountId ? ruleOf(affiliates, order.accountId) : DEFAULT_ACCOUNT_AFFILIATE_RULE;
    if (!rule.enabled) return [];
    const amount = commissionCents(rule.commission ?? affiliates.program.commission, order.total);
    const canceled = order.status === "canceled" || link.canceledManually === true;
    return [
      {
        id: `com_${order.code}`,
        affiliateId: link.affiliateId,
        orderCode: order.code,
        via: link.via,
        accountHandle: order.accountHandle,
        accountPlatform: order.accountPlatform,
        base: order.total,
        amount,
        status: canceled ? "canceled" : "pending",
        releaseAt: order.deliveredAt ? new Date(Date.parse(order.deliveredAt) + guaranteeDays * 86_400_000).toISOString() : null,
        canceledReason: canceled ? (link.canceledManually ? "manual" : "order_canceled") : null,
        createdAt: order.createdAt,
      },
    ];
  });
  return [...fromOrders, ...affiliates.seededCommissions].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function accountCommissionsFor(state: DemoState): AccountCommissions {
  const affiliates = stateOf(state);
  if (!affiliates.program.enabled) return new Map();
  return new Map(
    state.accounts
      .filter((account) => account.status !== "sold" && ruleOf(affiliates, account.id).enabled)
      .map((account) => [account.id, commissionCents(ruleOf(affiliates, account.id).commission ?? affiliates.program.commission, account.price)]),
  );
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

  async saveAccountRule(accountId: string, rule: AccountAffiliateRule): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      stateOf(state).accountRules[accountId] = rule;
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
    const program = stateOf(this.db.read()).program;
    if (!program.enabled) throw new Error(AFFILIATE_SIGNUP_MESSAGE.program_closed);
    if (input.termsSha256 !== (await sha256Hex(program.terms))) throw new Error(AFFILIATE_SIGNUP_MESSAGE.outdated_terms);
    return this.db.write((state) => {
      const affiliates = stateOf(state);
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
        status: program.autoApprove ? "approved" : "pending",
        statusNote: null,
        partnerId: null,
        termsAcceptedAt: now,
        approvedAt: program.autoApprove ? now : null,
        createdAt: now,
        password: input.password,
        document: input.document,
      };
      affiliates.affiliates.push(created);
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
    return this.approvedMe(state) ? accountCommissionsFor(state) : new Map();
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
