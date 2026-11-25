import { FunctionsHttpError, type Session, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type {
  AffiliateAdminRepository,
  AffiliateAuthState,
  AffiliatePortalService,
  AffiliateProfileUpdate,
  AffiliateSignupResult,
  AffiliateTrackingService,
  TrackedClick,
} from "@/application/affiliate-ports";
import {
  AFFILIATE_SIGNUP_MESSAGE,
  AFFILIATE_STATUSES,
  COMMISSION_CANCEL_REASONS,
  COMMISSION_KINDS,
  COMMISSION_VIAS,
  affiliateSignupErrorOf,
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
  type RankingEntry,
} from "@/domain/affiliate";
import {
  ASSIGN_ORDER_MESSAGE,
  GIFT_ERRORS,
  GIFT_ERROR_MESSAGE,
  assignOrderErrorOf,
  type AffiliateGift,
  type AffiliateGiftClaim,
  type AffiliateGiftData,
  type AffiliatePayout,
  type AffiliateStoreStats,
  type AffiliateWhatsAppLead,
} from "@/domain/affiliate-rewards";
import { CouponCodeTakenError, InvalidCredentialsError } from "@/domain/errors";
import { fail } from "./supabase-repositories";

export const AFFILIATE_SIGNUP_FUNCTION = "affiliate-signup";
const UNIQUE_VIOLATION = "23505";

// ---------------------------------------------------------------------------
// Linhas do banco
// ---------------------------------------------------------------------------

const programRowSchema = z.object({
  enabled: z.boolean(),
  auto_approve: z.boolean(),
  commission_kind: z.enum(COMMISSION_KINDS),
  commission_value: z.number(),
  link_days: z.number(),
  min_withdrawal_cents: z.number(),
  daily_auto_limit_cents: z.number(),
  manual_approval_above_cents: z.number(),
  terms: z.string(),
  welcome_text: z.string().nullable(),
  payout_batch_size: z.number(),
  banner_title: z.string().nullable(),
  banner_text: z.string().nullable(),
  updated_at: z.string(),
});

const PROGRAM_COLUMNS =
  "enabled, auto_approve, commission_kind, commission_value, link_days, min_withdrawal_cents, daily_auto_limit_cents, manual_approval_above_cents, terms, welcome_text, payout_batch_size, banner_title, banner_text, updated_at";

function toProgram(raw: unknown): AffiliateProgram {
  const row = programRowSchema.parse(raw);
  return {
    enabled: row.enabled,
    autoApprove: row.auto_approve,
    commission: { kind: row.commission_kind, value: row.commission_value },
    linkDays: row.link_days,
    minWithdrawal: row.min_withdrawal_cents,
    dailyAutoLimit: row.daily_auto_limit_cents,
    manualApprovalAbove: row.manual_approval_above_cents,
    terms: row.terms,
    welcomeText: row.welcome_text,
    payoutBatchSize: row.payout_batch_size,
    bannerTitle: row.banner_title,
    bannerText: row.banner_text,
    updatedAt: row.updated_at,
  };
}

const toProgramRow = (data: AffiliateProgramData) => ({
  enabled: data.enabled,
  auto_approve: data.autoApprove,
  commission_kind: data.commission.kind,
  commission_value: data.commission.value,
  link_days: data.linkDays,
  min_withdrawal_cents: data.minWithdrawal,
  daily_auto_limit_cents: data.dailyAutoLimit,
  manual_approval_above_cents: data.manualApprovalAbove,
  terms: data.terms,
  welcome_text: data.welcomeText,
  payout_batch_size: data.payoutBatchSize,
  banner_title: data.bannerTitle,
  banner_text: data.bannerText,
});

async function readProgram(client: SupabaseClient): Promise<AffiliateProgram> {
  const { data, error } = await client.from("affiliate_program").select(PROGRAM_COLUMNS).single();
  if (error) fail(error);
  return toProgram(data);
}

const AFFILIATE_COLUMNS =
  "id, code, name, email, whatsapp, pix_key, status, status_note, partner_id, commission_kind, commission_value, notifications_seen_at, terms_accepted_at, approved_at, created_at";

const affiliateRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  email: z.string(),
  whatsapp: z.string().nullable(),
  pix_key: z.string().nullable(),
  status: z.enum(AFFILIATE_STATUSES),
  status_note: z.string().nullable(),
  partner_id: z.string().nullable(),
  commission_kind: z.enum(COMMISSION_KINDS).nullable(),
  commission_value: z.number().nullable(),
  notifications_seen_at: z.string().nullable(),
  terms_accepted_at: z.string(),
  approved_at: z.string().nullable(),
  created_at: z.string(),
});

function toAffiliate(raw: unknown): Affiliate {
  const row = affiliateRowSchema.parse(raw);
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    email: row.email,
    whatsapp: row.whatsapp,
    pixKey: row.pix_key,
    status: row.status,
    statusNote: row.status_note,
    partnerId: row.partner_id,
    commission: row.commission_kind && row.commission_value !== null ? { kind: row.commission_kind, value: row.commission_value } : null,
    notificationsSeenAt: row.notifications_seen_at,
    termsAcceptedAt: row.terms_accepted_at,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
  };
}

const COMMISSION_COLUMNS =
  "id, affiliate_id, order_code, via, account_handle, account_platform, base_cents, amount_cents, status, release_at, canceled_reason, payout_id, created_at";

const commissionRowSchema = z.object({
  id: z.string(),
  affiliate_id: z.string(),
  order_code: z.string(),
  via: z.enum(COMMISSION_VIAS),
  account_handle: z.string().nullable(),
  account_platform: z.string().nullable(),
  base_cents: z.number(),
  amount_cents: z.number(),
  status: z.enum(["pending", "canceled", "paid"]),
  release_at: z.string().nullable(),
  canceled_reason: z.enum(COMMISSION_CANCEL_REASONS).nullable(),
  payout_id: z.string().nullable(),
  created_at: z.string(),
});

function toCommission(raw: unknown): AffiliateCommission {
  const row = commissionRowSchema.parse(raw);
  return {
    id: row.id,
    affiliateId: row.affiliate_id,
    orderCode: row.order_code,
    via: row.via,
    accountHandle: row.account_handle,
    accountPlatform: row.account_platform,
    base: row.base_cents,
    amount: row.amount_cents,
    status: row.status,
    releaseAt: row.release_at,
    canceledReason: row.canceled_reason,
    payoutId: row.payout_id,
    createdAt: row.created_at,
  };
}

async function readCommissions(client: SupabaseClient): Promise<AffiliateCommission[]> {
  const { data, error } = await client.from("affiliate_commissions").select(COMMISSION_COLUMNS).order("created_at", { ascending: false });
  if (error) fail(error);
  return data.map(toCommission);
}

const clickRowSchema = z.object({ affiliate_id: z.string(), account_id: z.string().nullable(), created_at: z.string() });

async function readClicks(client: SupabaseClient): Promise<AffiliateClick[]> {
  const { data, error } = await client.from("affiliate_clicks").select("affiliate_id, account_id, created_at").order("created_at", { ascending: false });
  if (error) fail(error);
  return data.map((raw) => {
    const row = clickRowSchema.parse(raw);
    return { affiliateId: row.affiliate_id, accountId: row.account_id, createdAt: row.created_at };
  });
}

const ANNOUNCEMENT_COLUMNS = "id, title, body, pinned, created_at";

const announcementRowSchema = z.object({ id: z.string(), title: z.string(), body: z.string(), pinned: z.boolean(), created_at: z.string() });

function toAnnouncement(raw: unknown): AffiliateAnnouncement {
  const row = announcementRowSchema.parse(raw);
  return { id: row.id, title: row.title, body: row.body, pinned: row.pinned, createdAt: row.created_at };
}

async function readAnnouncements(client: SupabaseClient): Promise<AffiliateAnnouncement[]> {
  const { data, error } = await client.from("affiliate_announcements").select(ANNOUNCEMENT_COLUMNS).order("created_at", { ascending: false });
  if (error) fail(error);
  return data.map(toAnnouncement);
}

const couponRowSchema = z.object({ code: z.string(), kind: z.enum(COMMISSION_KINDS), value: z.number() });

const payoutRowSchema = z.object({
  id: z.string(),
  affiliate_id: z.string(),
  commissions_count: z.number(),
  amount_cents: z.number(),
  pix_key: z.string().nullable(),
  note: z.string().nullable(),
  paid_at: z.string(),
});

async function readPayouts(client: SupabaseClient): Promise<AffiliatePayout[]> {
  const { data, error } = await client
    .from("affiliate_payouts")
    .select("id, affiliate_id, commissions_count, amount_cents, pix_key, note, paid_at")
    .order("paid_at", { ascending: false });
  if (error) fail(error);
  return data.map((raw) => {
    const row = payoutRowSchema.parse(raw);
    return {
      id: row.id,
      affiliateId: row.affiliate_id,
      commissionsCount: row.commissions_count,
      amount: row.amount_cents,
      pixKey: row.pix_key,
      note: row.note,
      paidAt: row.paid_at,
    };
  });
}

const GIFT_COLUMNS = "id, title, description, affiliate_id, expires_at, active, created_at";

const giftRowSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  affiliate_id: z.string().nullable(),
  expires_at: z.string().nullable(),
  active: z.boolean(),
  created_at: z.string(),
});

function toGift(raw: unknown): AffiliateGift {
  const row = giftRowSchema.parse(raw);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    affiliateId: row.affiliate_id,
    expiresAt: row.expires_at,
    active: row.active,
    createdAt: row.created_at,
  };
}

async function readGifts(client: SupabaseClient): Promise<AffiliateGift[]> {
  const { data, error } = await client.from("affiliate_gifts").select(GIFT_COLUMNS).order("created_at", { ascending: false });
  if (error) fail(error);
  return data.map(toGift);
}

const claimRowSchema = z.object({ gift_id: z.string(), affiliate_id: z.string(), claimed_at: z.string(), delivered_at: z.string().nullable() });

async function readGiftClaims(client: SupabaseClient): Promise<AffiliateGiftClaim[]> {
  const { data, error } = await client
    .from("affiliate_gift_claims")
    .select("gift_id, affiliate_id, claimed_at, delivered_at")
    .order("claimed_at", { ascending: false });
  if (error) fail(error);
  return data.map((raw) => {
    const row = claimRowSchema.parse(raw);
    return { giftId: row.gift_id, affiliateId: row.affiliate_id, claimedAt: row.claimed_at, deliveredAt: row.delivered_at };
  });
}

const leadRowSchema = z.object({ affiliate_id: z.string(), created_at: z.string() });

async function readWhatsAppLeads(client: SupabaseClient): Promise<AffiliateWhatsAppLead[]> {
  const { data, error } = await client.from("affiliate_whatsapp_leads").select("affiliate_id, created_at").order("created_at", { ascending: false });
  if (error) fail(error);
  return data.map((raw) => {
    const row = leadRowSchema.parse(raw);
    return { affiliateId: row.affiliate_id, createdAt: row.created_at };
  });
}

const storeStatsSchema = z.object({ affiliates: z.number(), sold_account_ids: z.array(z.string()) }).nullable();

async function readStoreStats(client: SupabaseClient, days: number): Promise<AffiliateStoreStats> {
  const { data, error } = await client.rpc("affiliate_store_stats", { p_days: days });
  if (error) fail(error);
  const row = storeStatsSchema.parse(data);
  return { approvedAffiliates: row?.affiliates ?? 0, soldAccountIds: row?.sold_account_ids ?? [] };
}

// ---------------------------------------------------------------------------
// Aba Parceiros
// ---------------------------------------------------------------------------

export class SupabaseAffiliateAdminRepository implements AffiliateAdminRepository {
  constructor(private readonly client: SupabaseClient) {}

  getProgram(): Promise<AffiliateProgram> {
    return readProgram(this.client);
  }

  async saveProgram(input: AffiliateProgramData): Promise<AffiliateProgram> {
    const { data, error } = await this.client.from("affiliate_program").update(toProgramRow(input)).eq("id", true).select(PROGRAM_COLUMNS).single();
    if (error) fail(error);
    return toProgram(data);
  }

  async listAffiliates(): Promise<Affiliate[]> {
    const { data, error } = await this.client.from("affiliates").select(AFFILIATE_COLUMNS).order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toAffiliate);
  }

  async findAffiliate(id: string): Promise<Affiliate | null> {
    const { data, error } = await this.client.from("affiliates").select(AFFILIATE_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toAffiliate(data) : null;
  }

  async documentOf(id: string): Promise<string | null> {
    const { data, error } = await this.client.rpc("affiliate_document_of", { p_affiliate_id: id });
    if (error) fail(error);
    return z.string().nullable().parse(data);
  }

  async changeStatus(id: string, change: AffiliateStatusChange): Promise<void> {
    const { error } = await this.client.from("affiliates").update({ status: change.status, status_note: change.statusNote }).eq("id", id);
    if (error) fail(error);
  }

  async linkPartner(id: string, partnerId: string | null): Promise<void> {
    const { error } = await this.client.from("affiliates").update({ partner_id: partnerId }).eq("id", id);
    if (error) fail(error);
  }

  async removeAffiliate(id: string): Promise<void> {
    const { error } = await this.client.from("affiliates").delete().eq("id", id);
    if (error) fail(error);
  }

  listCommissions(): Promise<AffiliateCommission[]> {
    return readCommissions(this.client);
  }

  async cancelCommission(id: string): Promise<void> {
    const { error } = await this.client.rpc("cancel_affiliate_commission", { p_commission_id: id });
    if (error) fail(error);
  }

  listClicks(): Promise<AffiliateClick[]> {
    return readClicks(this.client);
  }

  async listCoupons(affiliateId: string): Promise<AffiliateCoupon[]> {
    const { data, error } = await this.client.from("coupons").select("code, kind, value").eq("affiliate_id", affiliateId).order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map((raw) => couponRowSchema.parse(raw));
  }

  async createCoupon(affiliateId: string, coupon: AffiliateCoupon): Promise<void> {
    const { error } = await this.client.from("coupons").insert({ code: coupon.code, kind: coupon.kind, value: coupon.value, affiliate_id: affiliateId });
    if (error?.code === UNIQUE_VIOLATION) throw new CouponCodeTakenError(coupon.code);
    if (error) fail(error);
  }

  listAnnouncements(): Promise<AffiliateAnnouncement[]> {
    return readAnnouncements(this.client);
  }

  async saveAnnouncement(id: string | null, input: AffiliateAnnouncementData): Promise<AffiliateAnnouncement> {
    const row = { title: input.title, body: input.body, pinned: input.pinned };
    const query = id
      ? this.client.from("affiliate_announcements").update(row).eq("id", id)
      : this.client.from("affiliate_announcements").insert(row);
    const { data, error } = await query.select(ANNOUNCEMENT_COLUMNS).single();
    if (error) fail(error);
    return toAnnouncement(data);
  }

  async removeAnnouncement(id: string): Promise<void> {
    const { error } = await this.client.from("affiliate_announcements").delete().eq("id", id);
    if (error) fail(error);
  }

  async getAccountRule(accountId: string): Promise<AccountAffiliateRule> {
    const { data, error } = await this.client
      .from("accounts")
      .select("affiliate_enabled, affiliate_commission_kind, affiliate_commission_value")
      .eq("id", accountId)
      .single();
    if (error) fail(error);
    const row = z
      .object({
        affiliate_enabled: z.boolean(),
        affiliate_commission_kind: z.enum(COMMISSION_KINDS).nullable(),
        affiliate_commission_value: z.number().nullable(),
      })
      .parse(data);
    return {
      enabled: row.affiliate_enabled,
      commission:
        row.affiliate_commission_kind && row.affiliate_commission_value !== null
          ? { kind: row.affiliate_commission_kind, value: row.affiliate_commission_value }
          : null,
    };
  }

  async listAccountRules(): Promise<ReadonlyMap<string, AccountAffiliateRule>> {
    const { data, error } = await this.client.from("accounts").select("id, affiliate_enabled, affiliate_commission_kind, affiliate_commission_value");
    if (error) fail(error);
    const rows = z
      .array(
        z.object({
          id: z.string(),
          affiliate_enabled: z.boolean(),
          affiliate_commission_kind: z.enum(COMMISSION_KINDS).nullable(),
          affiliate_commission_value: z.number().nullable(),
        }),
      )
      .parse(data);
    return new Map(
      rows.map((row) => [
        row.id,
        {
          enabled: row.affiliate_enabled,
          commission:
            row.affiliate_commission_kind && row.affiliate_commission_value !== null
              ? { kind: row.affiliate_commission_kind, value: row.affiliate_commission_value }
              : null,
        },
      ]),
    );
  }
  async saveAccountRule(accountId: string, rule: AccountAffiliateRule): Promise<void> {
    const { error } = await this.client
      .from("accounts")
      .update({
        affiliate_enabled: rule.enabled,
        affiliate_commission_kind: rule.commission?.kind ?? null,
        affiliate_commission_value: rule.commission?.value ?? null,
      })
      .eq("id", accountId);
    if (error) fail(error);
  }

  async saveAffiliateCommission(id: string, rule: CommissionRule | null): Promise<void> {
    const { error } = await this.client
      .from("affiliates")
      .update({ commission_kind: rule?.kind ?? null, commission_value: rule?.value ?? null })
      .eq("id", id);
    if (error) fail(error);
  }

  listPayouts(): Promise<AffiliatePayout[]> {
    return readPayouts(this.client);
  }

  async payCommissions(affiliateId: string, commissionIds: readonly string[], note: string | null): Promise<string> {
    const { data, error } = await this.client.rpc("pay_affiliate_commissions", {
      p_affiliate_id: affiliateId,
      p_commission_ids: commissionIds,
      p_note: note,
    });
    if (error?.message.includes("commissions_not_payable")) {
      throw new Error("Alguma dessas indicações já foi paga ou cancelada. Atualize a página e tente de novo.");
    }
    if (error) fail(error);
    return z.string().parse(data);
  }

  async undoPayout(payoutId: string): Promise<void> {
    const { error } = await this.client.rpc("undo_affiliate_payout", { p_payout_id: payoutId });
    if (error) fail(error);
  }

  listGifts(): Promise<AffiliateGift[]> {
    return readGifts(this.client);
  }

  async saveGift(id: string | null, input: AffiliateGiftData): Promise<AffiliateGift> {
    const row = {
      title: input.title,
      description: input.description,
      affiliate_id: input.affiliateId,
      expires_at: input.expiresAt,
      active: input.active,
    };
    const query = id ? this.client.from("affiliate_gifts").update(row).eq("id", id) : this.client.from("affiliate_gifts").insert(row);
    const { data, error } = await query.select(GIFT_COLUMNS).single();
    if (error) fail(error);
    return toGift(data);
  }

  async removeGift(id: string): Promise<void> {
    const { error } = await this.client.from("affiliate_gifts").delete().eq("id", id);
    if (error) fail(error);
  }

  listGiftClaims(): Promise<AffiliateGiftClaim[]> {
    return readGiftClaims(this.client);
  }

  async setGiftDelivered(giftId: string, affiliateId: string, delivered: boolean): Promise<void> {
    const { error } = await this.client.rpc("set_affiliate_gift_delivered", {
      p_gift_id: giftId,
      p_affiliate_id: affiliateId,
      p_delivered: delivered,
    });
    if (error) fail(error);
  }

  async assignOrder(orderCode: string, affiliateId: string): Promise<number> {
    const { data, error } = await this.client.rpc("assign_order_affiliate", { p_order_code: orderCode, p_affiliate_id: affiliateId });
    if (error) {
      const known = assignOrderErrorOf(error.message);
      if (known) throw new Error(ASSIGN_ORDER_MESSAGE[known]);
      fail(error);
    }
    return z.number().parse(data);
  }

  listWhatsAppLeads(): Promise<AffiliateWhatsAppLead[]> {
    return readWhatsAppLeads(this.client);
  }

  storeStats(days: number): Promise<AffiliateStoreStats> {
    return readStoreStats(this.client, days);
  }
}

// ---------------------------------------------------------------------------
// Painel do afiliado
// ---------------------------------------------------------------------------

const signupResultSchema = z.object({ status: z.enum(AFFILIATE_STATUSES), code: z.string() });
const functionErrorSchema = z.object({ error: z.string() });

const stateOf = (session: Session | null): AffiliateAuthState =>
  session?.user.email ? { status: "signed-in", email: session.user.email } : { status: "signed-out" };

/**
 * Usa um cliente Supabase só dele (outra chave no navegador): entrar como afiliado não derruba o login do painel
 * da loja aberto no mesmo navegador, e vice-versa.
 */
export class SupabaseAffiliatePortalService implements AffiliatePortalService {
  constructor(private readonly client: SupabaseClient) {}

  getProgram(): Promise<AffiliateProgram> {
    return readProgram(this.client);
  }

  async signUp(input: AffiliateSignup): Promise<AffiliateSignupResult> {
    const { data, error } = await this.client.functions.invoke(AFFILIATE_SIGNUP_FUNCTION, { body: input });
    if (error) {
      console.error(error);
      const body: unknown = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      const parsed = functionErrorSchema.safeParse(body);
      const known = parsed.success ? affiliateSignupErrorOf(parsed.data.error) : null;
      throw new Error(known ? AFFILIATE_SIGNUP_MESSAGE[known] : "Não foi possível concluir o cadastro agora. Tente de novo em instantes.");
    }
    return signupResultSchema.parse(data);
  }

  async getAuthState(): Promise<AffiliateAuthState> {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return stateOf(data.session);
  }

  onAuthChange(listener: (state: AffiliateAuthState) => void): () => void {
    // Só entrar e sair: a renovação do token a cada hora não precisa recarregar o painel.
    const { data } = this.client.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") listener(stateOf(session));
    });
    return () => data.subscription.unsubscribe();
  }

  async signIn(email: string, password: string): Promise<void> {
    const { error } = await this.client.auth.signInWithPassword({ email, password });
    if (!error) return;
    if (error.status === 400) throw new InvalidCredentialsError();
    console.error(error);
    throw new Error("Não foi possível entrar agora. Tente de novo em instantes.");
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) throw error;
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (!error) return;
    console.error(error);
    throw new Error("Não foi possível enviar o link agora. Tente de novo em alguns minutos.");
  }

  async updatePassword(password: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password });
    if (!error) return;
    console.error(error);
    if (error.code === "same_password") throw new Error("A nova senha precisa ser diferente da atual.");
    throw new Error("Não foi possível trocar a senha. Abra o link do e-mail de novo.");
  }

  async loadMe(): Promise<AffiliateMe | null> {
    const { data: auth, error: authError } = await this.client.auth.getUser();
    if (authError) throw authError;
    // Filtra pelo próprio login: quem também é da equipe da loja enxerga outros afiliados pela política do painel.
    const { data, error } = await this.client.from("affiliates").select(AFFILIATE_COLUMNS).eq("user_id", auth.user.id).maybeSingle();
    if (error) fail(error);
    if (!data) return null;
    const affiliate = toAffiliate(data);
    const coupon = affiliate.status === "approved" ? await this.myCoupon() : null;
    return { ...affiliate, coupon };
  }

  private async myCoupon(): Promise<AffiliateCoupon | null> {
    const { data, error } = await this.client.rpc("my_affiliate_coupon");
    if (error) fail(error);
    const [first] = z.array(couponRowSchema).parse(data);
    return first ?? null;
  }

  async myDocument(affiliateId: string): Promise<string | null> {
    const { data, error } = await this.client.rpc("affiliate_document_of", { p_affiliate_id: affiliateId });
    if (error) fail(error);
    return z.string().nullable().parse(data);
  }

  async updateProfile(update: AffiliateProfileUpdate): Promise<void> {
    const { error } = await this.client.rpc("update_my_affiliate_profile", {
      p_name: update.name,
      p_whatsapp: update.whatsapp,
      p_document: update.document,
      p_pix_key: update.pixKey,
    });
    if (!error) return;
    if (error.message.includes("document_taken")) throw new Error(AFFILIATE_SIGNUP_MESSAGE.document_taken);
    if (error.message.includes("invalid_document")) throw new Error(AFFILIATE_SIGNUP_MESSAGE.invalid_document);
    fail(error);
  }

  listCommissions(): Promise<AffiliateCommission[]> {
    return readCommissions(this.client);
  }

  listClicks(): Promise<AffiliateClick[]> {
    return readClicks(this.client);
  }

  async accountCommissions(): Promise<AccountCommissions> {
    const { data, error } = await this.client.rpc("affiliate_account_commissions");
    if (error) fail(error);
    const rows = z.array(z.object({ account_id: z.string(), commission_cents: z.number() })).parse(data);
    return new Map(rows.map((row) => [row.account_id, row.commission_cents]));
  }

  async ranking(days: number): Promise<RankingEntry[]> {
    const { data, error } = await this.client.rpc("affiliate_ranking", { p_days: days });
    if (error) fail(error);
    return z
      .array(z.object({ rank: z.number(), display_name: z.string(), sales: z.number(), is_me: z.boolean() }))
      .parse(data)
      .map((row) => ({ rank: row.rank, displayName: row.display_name, sales: row.sales, isMe: row.is_me }));
  }

  listAnnouncements(): Promise<AffiliateAnnouncement[]> {
    return readAnnouncements(this.client);
  }

  listPayouts(): Promise<AffiliatePayout[]> {
    return readPayouts(this.client);
  }

  listGifts(): Promise<AffiliateGift[]> {
    return readGifts(this.client);
  }

  listGiftClaims(): Promise<AffiliateGiftClaim[]> {
    return readGiftClaims(this.client);
  }

  async claimGift(giftId: string): Promise<void> {
    const { error } = await this.client.rpc("claim_affiliate_gift", { p_gift_id: giftId });
    if (!error) return;
    const known = GIFT_ERRORS.find((code) => error.message.includes(code));
    if (known) throw new Error(GIFT_ERROR_MESSAGE[known]);
    fail(error);
  }

  async markNoticesSeen(): Promise<void> {
    const { error } = await this.client.rpc("mark_affiliate_notifications_seen");
    if (error) fail(error);
  }

  listWhatsAppLeads(): Promise<AffiliateWhatsAppLead[]> {
    return readWhatsAppLeads(this.client);
  }

  storeStats(days: number): Promise<AffiliateStoreStats> {
    return readStoreStats(this.client, days);
  }
}

// ---------------------------------------------------------------------------
// Link do afiliado no site
// ---------------------------------------------------------------------------

const trackedSchema = z.object({ click_id: z.string(), link_days: z.number() }).nullable();

export class SupabaseAffiliateTrackingService implements AffiliateTrackingService {
  constructor(private readonly client: SupabaseClient) {}

  async track(code: string, accountSlug: string | null): Promise<TrackedClick | null> {
    const { data, error } = await this.client.rpc("track_affiliate_click", { p_code: code, p_account_slug: accountSlug });
    if (error) fail(error);
    const tracked = trackedSchema.parse(data);
    return tracked ? { clickId: tracked.click_id, linkDays: tracked.link_days } : null;
  }

  async attach(orderCode: string, clickId: string): Promise<boolean> {
    const { data, error } = await this.client.rpc("attach_affiliate_click", { p_order_code: orderCode, p_click_id: clickId });
    if (error) fail(error);
    return z.boolean().parse(data);
  }
}
