import { z } from "zod";
import {
  AFFILIATE_STATUSES,
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
import { isValidCpf } from "@/domain/brazil";
import { COUPON_CODE_PATTERN, MAX_COUPON_PERCENT, normalizeCouponCode } from "@/domain/coupon";
import type { Cents } from "@/domain/money";
import type { Partner } from "@/domain/partner";
import type { AffiliateAdminRepository, AffiliatePortalService, AffiliateSignupResult, AffiliateTrackingService, TrackedClick } from "./affiliate-ports";
import { newPassword, optionalText, optionalWhatsapp, parseOrThrow, personName } from "./schemas";

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
  totals: CommissionTotals;
  /** Vendas por clique, em %. */
  conversion: number | null;
}

export interface AffiliatesBoard {
  program: AffiliateProgram;
  summaries: AffiliateSummary[];
  commissions: AffiliateCommission[];
  totals: CommissionTotals;
}

function summarize(
  affiliates: readonly Affiliate[],
  commissions: readonly AffiliateCommission[],
  clicks: readonly AffiliateClick[],
  partners: readonly Partner[],
  now: Date,
): AffiliateSummary[] {
  return affiliates.map((affiliate) => {
    const own = commissions.filter((commission) => commission.affiliateId === affiliate.id);
    const totals = summarizeCommissions(own, now);
    const clickCount = clicks.filter((click) => click.affiliateId === affiliate.id).length;
    return {
      affiliate,
      partner: partners.find((partner) => partner.id === affiliate.partnerId) ?? null,
      clicks: clickCount,
      totals,
      conversion: conversionRate(totals.sales, clickCount),
    };
  });
}

interface AdminAffiliateDeps {
  affiliates: AffiliateAdminRepository;
  partners: { listAll(): Promise<Partner[]> };
}

export async function loadAffiliatesBoard(deps: AdminAffiliateDeps, now: Date = new Date()): Promise<AffiliatesBoard> {
  const [program, affiliates, commissions, clicks, partners] = await Promise.all([
    deps.affiliates.getProgram(),
    deps.affiliates.listAffiliates(),
    deps.affiliates.listCommissions(),
    deps.affiliates.listClicks(),
    deps.partners.listAll(),
  ]);
  return {
    program,
    summaries: summarize(affiliates, commissions, clicks, partners, now),
    commissions,
    totals: summarizeCommissions(commissions, now),
  };
}

export interface AffiliateDetail extends AffiliateSummary {
  commissions: AffiliateCommission[];
  coupons: AffiliateCoupon[];
  partners: Partner[];
}

export async function loadAffiliateDetail(deps: AdminAffiliateDeps, id: string, now: Date = new Date()): Promise<AffiliateDetail | null> {
  const [affiliate, commissions, clicks, partners, coupons] = await Promise.all([
    deps.affiliates.findAffiliate(id),
    deps.affiliates.listCommissions(),
    deps.affiliates.listClicks(),
    deps.partners.listAll(),
    deps.affiliates.listCoupons(id),
  ]);
  if (!affiliate) return null;
  const [summary] = summarize([affiliate], commissions, clicks, partners, now);
  if (!summary) return null;
  return {
    ...summary,
    commissions: commissions.filter((commission) => commission.affiliateId === id),
    coupons,
    partners,
  };
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
}

/** Tudo da tela inicial. Afiliado não aprovado vê só a própria ficha (o banco não devolve o resto). */
export async function loadAffiliateHome(portal: AffiliatePortalService, me: AffiliateMe, now: Date = new Date()): Promise<AffiliateHome> {
  const approved = me.status === "approved";
  const [program, commissions, clicks, ranking, announcements] = await Promise.all([
    portal.getProgram(),
    portal.listCommissions(),
    portal.listClicks(),
    approved ? portal.ranking(30) : Promise.resolve([]),
    approved ? portal.listAnnouncements() : Promise.resolve([]),
  ]);
  const totals = summarizeCommissions(commissions, now);
  return {
    me,
    program,
    commissions,
    totals,
    clicks,
    conversion: conversionRate(totals.sales, clicks.length),
    ranking,
    announcements: sortAnnouncements(announcements),
  };
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
