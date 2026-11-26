import { z } from "zod";
import {
  AFFILIATE_STATUSES,
  AFFILIATE_TEXT_LIMITS,
  COMMISSION_KINDS,
  MAX_COMMISSION_PERCENT,
  MAX_FIXED_COMMISSION_CENTS,
  MIN_FIXED_COMMISSION_CENTS,
  conversionRate,
  sortAnnouncements,
  summarizeCommissions,
  type AccountAffiliateRule,
  type AccountCommissions,
  type Affiliate,
  type AffiliateAnnouncement,
  type AffiliateClick,
  type AffiliateCommission,
  type AffiliateCoupon,
  type AffiliateMe,
  type AffiliateProgram,
  type CommissionTotals,
  type RankingEntry,
} from "@/domain/affiliate";
import {
  MAX_RULE_MIN_FOLLOWERS,
  sortCommissionRules,
  type AffiliateCommissionRule,
  type CommissionRuleData,
  type CommissionRuleOwner,
  type MyCommissionRule,
} from "@/domain/affiliate-commission-rules";
import type { AffiliateInvite, AffiliateInviteData } from "@/domain/affiliate-invite";
import {
  MAX_INCENTIVE_SALES,
  MIN_INCENTIVE_SALES,
  STORE_STATS_DAYS,
  affiliateNoticesOf,
  giftStateOf,
  payoutStatusOf,
  type AffiliateBalanceCoupon,
  type AffiliateGift,
  type AffiliateGiftClaim,
  type AffiliateNotice,
  type AffiliatePayout,
  type AffiliateStoreStats,
  type AffiliateWhatsAppLead,
  type GiftState,
  type PayoutStatus,
} from "@/domain/affiliate-rewards";
import type { Account } from "@/domain/account";
import { isValidCpf } from "@/domain/brazil";
import { COUPON_CODE_PATTERN, MAX_COUPON_PERCENT, normalizeCouponCode } from "@/domain/coupon";
import type { Cents } from "@/domain/money";
import type { Partner } from "@/domain/partner";
import { STOCK_CATEGORIES, stockCategoryOf, type StockCategory } from "@/domain/stock";
import type { AffiliateAdminRepository, AffiliatePortalService, AffiliateSignupResult, AffiliateTrackingService, TrackedClick } from "./affiliate-ports";
import type { AccountRepository, StoreSettingsRepository } from "./ports";
import { newPassword, optionalText, optionalWhatsapp, parseOrThrow, personName } from "./schemas";

const DEFAULT_GUARANTEE_DAYS = 7;

// ---------------------------------------------------------------------------
// Regras de validação (mesmas checagens do banco)
// ---------------------------------------------------------------------------

const commissionRuleSchema = z
  .object({
    kind: z.enum(COMMISSION_KINDS, { message: "Escolha o tipo da comissão." }),
    value: z.number({ message: "Informe a comissão." }).int("Informe a comissão."),
  })
  .refine((rule) => rule.kind !== "percent" || (rule.value >= 1 && rule.value <= MAX_COMMISSION_PERCENT), {
    path: ["value"],
    message: `Use de 1% a ${MAX_COMMISSION_PERCENT}%.`,
  })
  .refine((rule) => rule.kind !== "fixed" || (rule.value >= MIN_FIXED_COMMISSION_CENTS && rule.value <= MAX_FIXED_COMMISSION_CENTS), {
    path: ["value"],
    message: "Use de R$ 1,00 a R$ 100.000,00.",
  });

const cents = (label: string, min: number, max: number) =>
  z
    .number({ message: `Informe ${label}.` })
    .int(`Informe ${label}.`)
    .min(min, `Use pelo menos R$ ${(min / 100).toFixed(2).replace(".", ",")}.`)
    .max(max, "Valor alto demais.");

export const affiliateProgramSchema = z.object({
  enabled: z.boolean(),
  autoApprove: z.boolean(),
  commission: commissionRuleSchema,
  linkDays: z.number({ message: "Informe os dias." }).int("Use um número inteiro.").min(1, "Use pelo menos 1 dia.").max(365, "Use no máximo 365 dias."),
  minWithdrawal: cents("o saque mínimo", 100, 10_000_000),
  dailyAutoLimit: cents("o limite diário", 0, 100_000_000),
  manualApprovalAbove: cents("o valor", 0, 100_000_000),
  terms: z.string().trim().max(20_000, "Use no máximo 20.000 caracteres."),
  welcomeText: optionalText(2000),
  incentiveSales: z
    .number({ message: "Informe quantas vendas entram no exemplo." })
    .int("Use um número inteiro.")
    .min(MIN_INCENTIVE_SALES, "Use pelo menos 1.")
    .max(MAX_INCENTIVE_SALES, `Use no máximo ${MAX_INCENTIVE_SALES}.`),
  bannerTitle: optionalText(120),
  bannerText: optionalText(500),
  texts: z.object({
    incentive: optionalText(AFFILIATE_TEXT_LIMITS.incentive),
    earnRule: optionalText(AFFILIATE_TEXT_LIMITS.earnRule),
    payoutInfo: optionalText(AFFILIATE_TEXT_LIMITS.payoutInfo),
    balanceNotice: optionalText(AFFILIATE_TEXT_LIMITS.balanceNotice),
    inviteMessage: optionalText(AFFILIATE_TEXT_LIMITS.inviteMessage),
  }),
});

export const commissionRuleDataSchema = z.object({
  category: z.enum(STOCK_CATEGORIES).nullable(),
  minFollowers: z
    .number({ message: "Informe os seguidores." })
    .int("Use um número inteiro.")
    .min(1, "Use pelo menos 1 seguidor.")
    .max(MAX_RULE_MIN_FOLLOWERS, "Número alto demais.")
    .nullable(),
  commission: commissionRuleSchema,
});

export const affiliateInviteSchema = z.object({
  name: personName,
  whatsapp: optionalWhatsapp,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .nullable()
    .transform((value) => value || null)
    .refine((value) => value === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value), "Informe um e-mail válido.")
    .refine((value) => value === null || value.length <= 254, "E-mail longo demais."),
  commission: commissionRuleSchema.nullable(),
  note: optionalText(500),
});

export const affiliateCommissionSchema = commissionRuleSchema.nullable();

export const affiliateGiftSchema = z.object({
  title: z.string().trim().min(2, "Dê um nome ao brinde.").max(120, "Use no máximo 120 caracteres."),
  description: optionalText(1000),
  affiliateId: z.string().min(1).nullable(),
  expiresAt: z
    .string()
    .nullable()
    .refine((value) => value === null || !Number.isNaN(Date.parse(value)), "Data inválida."),
  active: z.boolean(),
});

export const assignOrderSchema = z.object({
  orderCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{4,30}$/, "Informe o código do pedido (ex.: JD-ABC123)."),
  affiliateId: z.string().min(1, "Escolha o afiliado."),
});

export const affiliateStatusSchema = z.object({
  status: z.enum(AFFILIATE_STATUSES),
  statusNote: optionalText(500),
});

export const affiliateAnnouncementSchema = z.object({
  title: z.string().trim().min(2, "Escreva um título.").max(120, "Use no máximo 120 caracteres."),
  body: z.string().trim().min(1, "Escreva o recado.").max(4000, "Use no máximo 4.000 caracteres."),
  pinned: z.boolean(),
});

export const accountAffiliateRuleSchema = z.object({
  enabled: z.boolean(),
  commission: commissionRuleSchema.nullable(),
});

export const affiliateCouponSchema = z.object({
  code: z.string().transform(normalizeCouponCode).pipe(z.string().regex(COUPON_CODE_PATTERN, "Use de 3 a 30 letras, números, - ou _ (sem espaço).")),
  kind: z.literal("percent"),
  value: z
    .number({ message: "Informe o desconto." })
    .int("Use um número inteiro.")
    .min(1, "Use pelo menos 1%.")
    .max(MAX_COUPON_PERCENT, `Use no máximo ${MAX_COUPON_PERCENT}%.`),
});

const cpfField = z
  .string()
  .transform((value) => value.replace(/\D/g, ""))
  .refine(isValidCpf, "Informe um CPF válido.");

const pixKeyField = z
  .string()
  .trim()
  .max(140, "Chave Pix longa demais.")
  .nullable()
  .transform((value) => (value ? value : null));

export const affiliateSignupSchema = z.object({
  name: personName,
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.").max(254, "E-mail longo demais.")),
  password: newPassword,
  whatsapp: optionalWhatsapp,
  document: cpfField,
  termsSha256: z.string().regex(/^[0-9a-f]{64}$/, "Recarregue a página e aceite os termos de novo."),
  acceptedTerms: z.literal(true, { message: "Para participar, aceite os termos do programa." }),
  inviteToken: z
    .string()
    .regex(/^[A-Za-z0-9_-]{20,64}$/, "O link do convite está incompleto. Abra de novo o link que a loja mandou.")
    .nullable(),
});

export const affiliateProfileSchema = z.object({
  name: personName,
  whatsapp: optionalWhatsapp,
  document: z
    .string()
    .nullable()
    .transform((value) => value?.replace(/\D/g, "") ?? "")
    .refine((digits) => digits === "" || isValidCpf(digits), "Informe um CPF válido.")
    .transform((digits) => digits || null),
  pixKey: pixKeyField,
});

export const affiliateSignInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(1, "Informe a senha."),
});

export const affiliateNewPasswordSchema = z
  .object({ password: newPassword, confirmation: z.string() })
  .refine((data) => data.password === data.confirmation, { path: ["confirmation"], message: "As duas senhas precisam ser iguais." });

/** SHA-256 em hexadecimal dos termos: o banco só aceita o cadastro com o hash da versão que está no ar. */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

// ---------------------------------------------------------------------------
// Aba Parceiros (o Jota)
// ---------------------------------------------------------------------------

export interface AffiliateSummary {
  affiliate: Affiliate;
  partner: Partner | null;
  clicks: number;
  /** Contatos que chegaram no WhatsApp oficial pelo link de indicação dele. */
  whatsappLeads: number;
  totals: CommissionTotals;
  /** Vendas por clique, em %. */
  conversion: number | null;
  /** Pagamento: o que está liberado para pagar, o que está na garantia e o que já foi pago. */
  payout: PayoutStatus;
}

export interface AffiliatesBoard {
  program: AffiliateProgram;
  summaries: AffiliateSummary[];
  commissions: AffiliateCommission[];
  totals: CommissionTotals;
}

interface SummarySources {
  program: AffiliateProgram;
  commissions: readonly AffiliateCommission[];
  clicks: readonly AffiliateClick[];
  leads: readonly AffiliateWhatsAppLead[];
  partners: readonly Partner[];
}

function summarize(affiliates: readonly Affiliate[], sources: SummarySources, now: Date): AffiliateSummary[] {
  return affiliates.map((affiliate) => {
    const own = sources.commissions.filter((commission) => commission.affiliateId === affiliate.id);
    const totals = summarizeCommissions(own, now);
    const clickCount = sources.clicks.filter((click) => click.affiliateId === affiliate.id).length;
    return {
      affiliate,
      partner: sources.partners.find((partner) => partner.id === affiliate.partnerId) ?? null,
      clicks: clickCount,
      whatsappLeads: sources.leads.filter((lead) => lead.affiliateId === affiliate.id).length,
      totals,
      conversion: conversionRate(totals.sales, clickCount),
      payout: payoutStatusOf(own, affiliate.payoutRequestedAt, now),
    };
  });
}

interface AdminAffiliateDeps {
  affiliates: AffiliateAdminRepository;
  partners: { listAll(): Promise<Partner[]> };
}

async function loadSummarySources(deps: AdminAffiliateDeps): Promise<SummarySources> {
  const [program, commissions, clicks, leads, partners] = await Promise.all([
    deps.affiliates.getProgram(),
    deps.affiliates.listCommissions(),
    deps.affiliates.listClicks(),
    deps.affiliates.listWhatsAppLeads(),
    deps.partners.listAll(),
  ]);
  return { program, commissions, clicks, leads, partners };
}

export async function loadAffiliatesBoard(deps: AdminAffiliateDeps, now: Date = new Date()): Promise<AffiliatesBoard> {
  const [sources, affiliates] = await Promise.all([loadSummarySources(deps), deps.affiliates.listAffiliates()]);
  return {
    program: sources.program,
    summaries: summarize(affiliates, sources, now),
    commissions: [...sources.commissions],
    totals: summarizeCommissions(sources.commissions, now),
  };
}

export interface AffiliateDetail extends AffiliateSummary {
  program: AffiliateProgram;
  commissions: AffiliateCommission[];
  coupons: AffiliateCoupon[];
  partners: Partner[];
  payouts: AffiliatePayout[];
  /** Regras de comissão só dele. */
  rules: AffiliateCommissionRule[];
}

export async function loadAffiliateDetail(deps: AdminAffiliateDeps, id: string, now: Date = new Date()): Promise<AffiliateDetail | null> {
  const [affiliate, sources, coupons, payouts, rules] = await Promise.all([
    deps.affiliates.findAffiliate(id),
    loadSummarySources(deps),
    deps.affiliates.listCoupons(id),
    deps.affiliates.listPayouts(),
    deps.affiliates.listCommissionRules(),
  ]);
  if (!affiliate) return null;
  const [summary] = summarize([affiliate], sources, now);
  if (!summary) return null;
  return {
    ...summary,
    program: sources.program,
    commissions: sources.commissions.filter((commission) => commission.affiliateId === id),
    coupons,
    partners: [...sources.partners],
    payouts: payouts.filter((payout) => payout.affiliateId === id),
    rules: sortCommissionRules(rules.filter((rule) => rule.affiliateId === id)),
  };
}

export function saveAffiliateCommission(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string, raw: unknown): Promise<void> {
  return deps.affiliates.saveAffiliateCommission(id, parseOrThrow(affiliateCommissionSchema, raw));
}

/** "Paguei": as comissões liberadas (garantia acabou) que estão esperando pagamento. */
export function payAffiliateCommissions(
  deps: Pick<AdminAffiliateDeps, "affiliates">,
  affiliateId: string,
  commissionIds: readonly string[],
  note: string | null,
): Promise<string> {
  if (commissionIds.length === 0) return Promise.reject(new Error("Não há comissão liberada para pagar."));
  const cleanNote = note?.trim().slice(0, 500) || null;
  return deps.affiliates.payCommissions(affiliateId, commissionIds, cleanNote);
}

export function undoAffiliatePayout(deps: Pick<AdminAffiliateDeps, "affiliates">, payoutId: string): Promise<void> {
  return deps.affiliates.undoPayout(payoutId);
}

// ---------------------------------------------------------------------------
// Regras de comissão e convites (o Jota)
// ---------------------------------------------------------------------------

/** Regras para todos os afiliados (aba Programa). */
export async function listGlobalCommissionRules(deps: Pick<AdminAffiliateDeps, "affiliates">): Promise<AffiliateCommissionRule[]> {
  const rules = await deps.affiliates.listCommissionRules();
  return sortCommissionRules(rules.filter((rule) => rule.affiliateId === null && rule.inviteId === null));
}

export function saveCommissionRule(
  deps: Pick<AdminAffiliateDeps, "affiliates">,
  id: string | null,
  owner: CommissionRuleOwner,
  raw: unknown,
): Promise<AffiliateCommissionRule> {
  return deps.affiliates.saveCommissionRule(id, owner, parseOrThrow(commissionRuleDataSchema, raw));
}

export function removeCommissionRule(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<void> {
  return deps.affiliates.removeCommissionRule(id);
}

export interface InviteBoardItem {
  invite: AffiliateInvite;
  rules: AffiliateCommissionRule[];
}

/** Convites ainda não aceitos, com as regras combinadas em cada um. */
export async function loadPendingInvites(deps: Pick<AdminAffiliateDeps, "affiliates">): Promise<InviteBoardItem[]> {
  const [invites, rules] = await Promise.all([deps.affiliates.listInvites(), deps.affiliates.listCommissionRules()]);
  return invites
    .filter((invite) => invite.status === "pending")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((invite) => ({ invite, rules: sortCommissionRules(rules.filter((rule) => rule.inviteId === invite.id)) }));
}

/** "Novo afiliado": cria o convite com a comissão e as regras combinadas. */
export async function createAffiliateInvite(
  deps: Pick<AdminAffiliateDeps, "affiliates">,
  raw: unknown,
  rawRules: readonly unknown[],
): Promise<AffiliateInvite> {
  const data: AffiliateInviteData = parseOrThrow(affiliateInviteSchema, raw);
  const rules: CommissionRuleData[] = rawRules.map((rule) => parseOrThrow(commissionRuleDataSchema, rule));
  const invite = await deps.affiliates.createInvite(data);
  for (const rule of rules) await deps.affiliates.saveCommissionRule(null, { kind: "invite", inviteId: invite.id }, rule);
  return invite;
}

export function revokeAffiliateInvite(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<void> {
  return deps.affiliates.revokeInvite(id);
}

export function assignOrderToAffiliate(deps: Pick<AdminAffiliateDeps, "affiliates">, raw: unknown): Promise<number> {
  const { orderCode, affiliateId } = parseOrThrow(assignOrderSchema, raw);
  return deps.affiliates.assignOrder(orderCode, affiliateId);
}

// ---------------------------------------------------------------------------
// Brindes (o Jota)
// ---------------------------------------------------------------------------

export interface GiftBoardItem {
  gift: AffiliateGift;
  /** Para quem é: nome do afiliado, ou nulo quando é para todos. */
  affiliateName: string | null;
  claims: (AffiliateGiftClaim & { affiliateName: string })[];
}

export async function loadGiftBoard(deps: Pick<AdminAffiliateDeps, "affiliates">): Promise<{ items: GiftBoardItem[]; affiliates: Affiliate[] }> {
  const [gifts, claims, affiliates] = await Promise.all([
    deps.affiliates.listGifts(),
    deps.affiliates.listGiftClaims(),
    deps.affiliates.listAffiliates(),
  ]);
  const nameOf = (affiliateId: string) => affiliates.find((affiliate) => affiliate.id === affiliateId)?.name ?? "Afiliado removido";
  return {
    affiliates,
    items: gifts.map((gift) => ({
      gift,
      affiliateName: gift.affiliateId ? nameOf(gift.affiliateId) : null,
      claims: claims.filter((claim) => claim.giftId === gift.id).map((claim) => ({ ...claim, affiliateName: nameOf(claim.affiliateId) })),
    })),
  };
}

export function saveAffiliateGift(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string | null, raw: unknown): Promise<AffiliateGift> {
  return deps.affiliates.saveGift(id, parseOrThrow(affiliateGiftSchema, raw));
}

export function removeAffiliateGift(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<void> {
  return deps.affiliates.removeGift(id);
}

export function setAffiliateGiftDelivered(
  deps: Pick<AdminAffiliateDeps, "affiliates">,
  giftId: string,
  affiliateId: string,
  delivered: boolean,
): Promise<void> {
  return deps.affiliates.setGiftDelivered(giftId, affiliateId, delivered);
}

export function saveAffiliateProgram(deps: Pick<AdminAffiliateDeps, "affiliates">, raw: unknown): Promise<AffiliateProgram> {
  return deps.affiliates.saveProgram(parseOrThrow(affiliateProgramSchema, raw));
}

export function changeAffiliateStatus(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string, raw: unknown): Promise<void> {
  return deps.affiliates.changeStatus(id, parseOrThrow(affiliateStatusSchema, raw));
}

export function linkAffiliatePartner(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string, partnerId: string | null): Promise<void> {
  return deps.affiliates.linkPartner(id, partnerId);
}

export function revealAffiliateDocument(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<string | null> {
  return deps.affiliates.documentOf(id);
}

export function createAffiliateCoupon(deps: Pick<AdminAffiliateDeps, "affiliates">, affiliateId: string, raw: unknown): Promise<void> {
  return deps.affiliates.createCoupon(affiliateId, parseOrThrow(affiliateCouponSchema, raw));
}

export function cancelAffiliateCommission(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<void> {
  return deps.affiliates.cancelCommission(id);
}

export function removeAffiliate(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<void> {
  return deps.affiliates.removeAffiliate(id);
}

export async function listAffiliateAnnouncements(deps: Pick<AdminAffiliateDeps, "affiliates">): Promise<AffiliateAnnouncement[]> {
  return sortAnnouncements(await deps.affiliates.listAnnouncements());
}

export function saveAffiliateAnnouncement(
  deps: Pick<AdminAffiliateDeps, "affiliates">,
  id: string | null,
  raw: unknown,
): Promise<AffiliateAnnouncement> {
  return deps.affiliates.saveAnnouncement(id, parseOrThrow(affiliateAnnouncementSchema, raw));
}

export function removeAffiliateAnnouncement(deps: Pick<AdminAffiliateDeps, "affiliates">, id: string): Promise<void> {
  return deps.affiliates.removeAnnouncement(id);
}

export function getAccountAffiliateRule(deps: Pick<AdminAffiliateDeps, "affiliates">, accountId: string): Promise<AccountAffiliateRule> {
  return deps.affiliates.getAccountRule(accountId);
}

export function saveAccountAffiliateRule(deps: Pick<AdminAffiliateDeps, "affiliates">, accountId: string, raw: unknown): Promise<void> {
  return deps.affiliates.saveAccountRule(accountId, parseOrThrow(accountAffiliateRuleSchema, raw));
}

// ---------------------------------------------------------------------------
// Painel do afiliado
// ---------------------------------------------------------------------------

export async function signUpAffiliate(portal: AffiliatePortalService, raw: unknown): Promise<AffiliateSignupResult> {
  const { acceptedTerms: _accepted, ...input } = parseOrThrow(affiliateSignupSchema, raw);
  return portal.signUp(input);
}

export function signInAffiliate(portal: AffiliatePortalService, raw: unknown): Promise<void> {
  const { email, password } = parseOrThrow(affiliateSignInSchema, raw);
  return portal.signIn(email, password);
}

export function setAffiliatePassword(portal: AffiliatePortalService, raw: unknown): Promise<void> {
  return portal.updatePassword(parseOrThrow(affiliateNewPasswordSchema, raw).password);
}

export function updateAffiliateProfile(portal: AffiliatePortalService, raw: unknown): Promise<void> {
  return portal.updateProfile(parseOrThrow(affiliateProfileSchema, raw));
}

export interface AffiliateHome {
  me: AffiliateMe;
  program: AffiliateProgram;
  commissions: AffiliateCommission[];
  totals: CommissionTotals;
  clicks: AffiliateClick[];
  conversion: number | null;
  ranking: RankingEntry[];
  announcements: AffiliateAnnouncement[];
  payout: PayoutStatus;
  payouts: AffiliatePayout[];
  /** Dias de garantia da loja: é quando cada venda fica liberada para receber. */
  guaranteeDays: number;
  /** Código de saldo valendo (para comprar conta), se ele gerou. */
  balanceCoupon: AffiliateBalanceCoupon | null;
  /** Regras de comissão que valem para ele. */
  commissionRules: MyCommissionRule[];
  whatsappLeads: number;
  /** Brindes esperando ele tocar em "Receber". */
  giftsToClaim: number;
  store: StoreSnapshot;
  /** Comissão dele em cada conta disponível (vazio se não aprovado). */
  accountCommissions: AccountCommissions;
}

/** Números da loja para a faixa do painel: contas disponíveis, afiliados e os tipos que mais venderam. */
export interface StoreSnapshot {
  availableAccounts: Account[];
  approvedAffiliates: number;
  topSold: { category: StockCategory; sold: number }[];
}

const TOP_SOLD_LIMIT = 3;

export function storeSnapshotOf(accounts: readonly Account[], stats: AffiliateStoreStats): StoreSnapshot {
  const sold = new Set(stats.soldAccountIds);
  const counts = new Map<StockCategory, number>();
  for (const account of accounts) {
    if (!sold.has(account.id)) continue;
    const category = stockCategoryOf(account);
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  return {
    availableAccounts: accounts.filter((account) => account.status === "available"),
    approvedAffiliates: stats.approvedAffiliates,
    topSold: [...counts.entries()]
      .map(([category, count]) => ({ category, sold: count }))
      .sort((a, b) => b.sold - a.sold || STOCK_CATEGORIES.indexOf(a.category) - STOCK_CATEGORIES.indexOf(b.category))
      .slice(0, TOP_SOLD_LIMIT),
  };
}

/** Tudo da tela inicial. Afiliado não aprovado vê só a própria ficha (o banco não devolve o resto). */
export async function loadAffiliateHome(
  portal: AffiliatePortalService,
  store: { accounts: AccountRepository; settings: StoreSettingsRepository },
  me: AffiliateMe,
  now: Date = new Date(),
): Promise<AffiliateHome> {
  const approved = me.status === "approved";
  const { accounts } = store;
  const [settings, balanceCoupon, commissionRules] = await Promise.all([
    store.settings.get().catch((error: unknown) => {
      console.error("Falha ao ler os dias de garantia", error);
      return null;
    }),
    approved ? portal.myBalanceCoupon() : Promise.resolve(null),
    approved ? portal.myCommissionRules() : Promise.resolve([]),
  ]);
  const [program, commissions, clicks, ranking, announcements, payouts, leads, gifts, claims, stats, allAccounts, accountCommissions] =
    await Promise.all([
      portal.getProgram(),
      portal.listCommissions(),
      portal.listClicks(),
      approved ? portal.ranking(30) : Promise.resolve([]),
      approved ? portal.listAnnouncements() : Promise.resolve([]),
      portal.listPayouts(),
      portal.listWhatsAppLeads(),
      approved ? portal.listGifts() : Promise.resolve([]),
      portal.listGiftClaims(),
      approved ? portal.storeStats(STORE_STATS_DAYS) : Promise.resolve({ approvedAffiliates: 0, soldAccountIds: [] }),
      approved ? accounts.list({}) : Promise.resolve([]),
      approved ? portal.accountCommissions() : Promise.resolve(new Map<string, Cents>()),
    ]);
  const totals = summarizeCommissions(commissions, now);
  const claimed = new Set(claims.map((claim) => claim.giftId));
  return {
    me,
    program,
    commissions,
    totals,
    clicks,
    conversion: conversionRate(totals.sales, clicks.length),
    ranking,
    announcements: sortAnnouncements(announcements),
    payout: payoutStatusOf(commissions, me.payoutRequestedAt, now),
    payouts,
    guaranteeDays: settings?.guaranteeDays ?? DEFAULT_GUARANTEE_DAYS,
    balanceCoupon,
    commissionRules,
    whatsappLeads: leads.length,
    giftsToClaim: gifts.filter((gift) => !claimed.has(gift.id) && (gift.expiresAt === null || new Date(gift.expiresAt) > now)).length,
    store: storeSnapshotOf(allAccounts, stats),
    accountCommissions,
  };
}

/** Sininho do painel: a linha do tempo e quantos avisos ele ainda não viu. */
export async function loadAffiliateNotices(
  portal: AffiliatePortalService,
  accounts: AccountRepository,
  me: AffiliateMe,
  now: Date = new Date(),
): Promise<AffiliateNotice[]> {
  const approved = me.status === "approved";
  const [commissions, payouts, gifts, claims, announcements, available] = await Promise.all([
    portal.listCommissions(),
    portal.listPayouts(),
    approved ? portal.listGifts() : Promise.resolve([]),
    portal.listGiftClaims(),
    approved ? portal.listAnnouncements() : Promise.resolve([]),
    approved ? accounts.list({ onlyAvailable: true }) : Promise.resolve([]),
  ]);
  return affiliateNoticesOf({ commissions, payouts, gifts, claims, announcements, newListings: available.map((account) => account.listedAt) }, me.notificationsSeenAt, now);
}

export interface AffiliateGiftView {
  gift: AffiliateGift;
  state: GiftState;
}

/** Aba Brindes do afiliado: os que pode receber primeiro, depois os pedidos e entregues. */
export async function loadAffiliateGifts(portal: AffiliatePortalService, now: Date = new Date()): Promise<AffiliateGiftView[]> {
  const [gifts, claims] = await Promise.all([portal.listGifts(), portal.listGiftClaims()]);
  const order: Record<GiftState, number> = { available: 0, claimed: 1, delivered: 2, expired: 3 };
  return gifts
    .map((gift) => ({ gift, state: giftStateOf(gift, claims.find((claim) => claim.giftId === gift.id), now) }))
    .sort((a, b) => order[a.state] - order[b.state] || b.gift.createdAt.localeCompare(a.gift.createdAt));
}

export function claimAffiliateGift(portal: AffiliatePortalService, giftId: string): Promise<void> {
  return portal.claimGift(giftId);
}

export function requestAffiliatePayout(portal: AffiliatePortalService): Promise<void> {
  return portal.requestPayout();
}

export function createAffiliateBalanceCoupon(portal: AffiliatePortalService): Promise<AffiliateBalanceCoupon> {
  return portal.createBalanceCoupon();
}

export function cancelAffiliateBalanceCoupon(portal: AffiliatePortalService): Promise<void> {
  return portal.cancelBalanceCoupon();
}

export interface ShareableAccount<A> {
  account: A;
  commission: Cents;
  clicks: number;
  sales: number;
}

/** Contas da vitrine que o afiliado pode divulgar, com a comissão e os números de cada link. */
export function shareableAccounts<A extends { id: string; handle: string }>(
  accounts: readonly A[],
  commissions: AccountCommissions,
  clicks: readonly AffiliateClick[],
  sales: readonly AffiliateCommission[],
): ShareableAccount<A>[] {
  return accounts
    .filter((account) => commissions.has(account.id))
    .map((account) => ({
      account,
      commission: commissions.get(account.id) ?? 0,
      clicks: clicks.filter((click) => click.accountId === account.id).length,
      sales: sales.filter((sale) => sale.status !== "canceled" && sale.accountHandle === account.handle).length,
    }));
}

// ---------------------------------------------------------------------------
// Visitante que veio pelo link
// ---------------------------------------------------------------------------

export interface StoredAffiliateClick {
  clickId: string;
  code: string;
  expiresAt: string;
}

export async function trackAffiliateVisit(
  tracking: AffiliateTrackingService,
  code: string,
  accountSlug: string | null,
  now: Date = new Date(),
): Promise<StoredAffiliateClick | null> {
  const tracked: TrackedClick | null = await tracking.track(code, accountSlug);
  if (!tracked) return null;
  const expiresAt = new Date(now.getTime() + tracked.linkDays * 86_400_000).toISOString();
  return { clickId: tracked.clickId, code, expiresAt };
}

export function attachAffiliateClick(tracking: AffiliateTrackingService, orderCode: string, click: StoredAffiliateClick, now: Date = new Date()): Promise<boolean> {
  if (new Date(click.expiresAt) <= now) return Promise.resolve(false);
  return tracking.attach(orderCode, click.clickId);
}
