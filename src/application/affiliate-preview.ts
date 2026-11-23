import {
  DEFAULT_ACCOUNT_AFFILIATE_RULE,
  commissionCents,
  publicAffiliateName,
  sortAnnouncements,
  type AccountCommissions,
  type AffiliateAnnouncement,
  type AffiliateClick,
  type AffiliateCommission,
  type AffiliateMe,
  type AffiliateProgram,
  type RankingEntry,
} from "@/domain/affiliate";
import { PreviewReadOnlyError } from "@/domain/errors";
import { maskEmail, maskPhone, maskSecret } from "@/domain/privacy-mask";
import type { AffiliateAdminRepository, AffiliateAuthState, AffiliatePortalService, AffiliateSignupResult } from "./affiliate-ports";
import type { AccountRepository } from "./ports";

const RANKING_DAYS = 30;
const DAY_MS = 86_400_000;

/**
 * Painel do afiliado visto pela equipe ("Ver como"): os mesmos dados que o afiliado vê, lidos pelo acesso do painel,
 * com dados pessoais mascarados e nada gravado. Mesmas regras das funções do banco que o afiliado chama.
 */
export class PreviewAffiliatePortalService implements AffiliatePortalService {
  constructor(
    private readonly admin: AffiliateAdminRepository,
    private readonly accounts: AccountRepository,
    private readonly affiliateId: string,
  ) {}

  private readOnly(): Promise<never> {
    return Promise.reject(new PreviewReadOnlyError());
  }

  getProgram(): Promise<AffiliateProgram> {
    return this.admin.getProgram();
  }

  signUp(): Promise<AffiliateSignupResult> {
    return this.readOnly();
  }

  async getAuthState(): Promise<AffiliateAuthState> {
    const affiliate = await this.admin.findAffiliate(this.affiliateId);
    return affiliate ? { status: "signed-in", email: maskEmail(affiliate.email) ?? affiliate.email } : { status: "signed-out" };
  }

  onAuthChange(): () => void {
    return () => undefined;
  }

  signIn(): Promise<void> {
    return this.readOnly();
  }

  signOut(): Promise<void> {
    return this.readOnly();
  }

  requestPasswordReset(): Promise<void> {
    return this.readOnly();
  }

  updatePassword(): Promise<void> {
    return this.readOnly();
  }

  async loadMe(): Promise<AffiliateMe | null> {
    const [affiliate, coupons] = await Promise.all([this.admin.findAffiliate(this.affiliateId), this.admin.listCoupons(this.affiliateId)]);
    if (!affiliate) return null;
    return {
      ...affiliate,
      email: maskEmail(affiliate.email) ?? affiliate.email,
      whatsapp: maskPhone(affiliate.whatsapp),
      pixKey: maskSecret(affiliate.pixKey),
      coupon: affiliate.status === "approved" ? (coupons[0] ?? null) : null,
    };
  }

  /** O CPF nunca aparece na visualização. */
  async myDocument(): Promise<string | null> {
    return null;
  }

  updateProfile(): Promise<void> {
    return this.readOnly();
  }

  async listCommissions(): Promise<AffiliateCommission[]> {
    return (await this.admin.listCommissions()).filter((commission) => commission.affiliateId === this.affiliateId);
  }

  async listClicks(): Promise<AffiliateClick[]> {
    return (await this.admin.listClicks()).filter((click) => click.affiliateId === this.affiliateId);
  }

  /** Igual a `affiliate_account_commissions`: só para aprovado, com o programa ligado, contas liberadas e não vendidas. */
  async accountCommissions(): Promise<AccountCommissions> {
    const [affiliate, program, rules, accounts] = await Promise.all([
      this.admin.findAffiliate(this.affiliateId),
      this.admin.getProgram(),
      this.admin.listAccountRules(),
      this.accounts.list({ onlyAvailable: true }),
    ]);
    if (affiliate?.status !== "approved" || !program.enabled) return new Map();
    const entries: [string, number][] = [];
    for (const account of accounts) {
      const rule = rules.get(account.id) ?? DEFAULT_ACCOUNT_AFFILIATE_RULE;
      if (account.status === "sold" || !rule.enabled) continue;
      entries.push([account.id, commissionCents(rule.commission ?? program.commission, account.price)]);
    }
    return new Map(entries);
  }

  /** Igual a `affiliate_ranking`: top 10 dos últimos 30 dias, só primeiro nome e inicial. */
  async ranking(): Promise<RankingEntry[]> {
    const [affiliates, commissions] = await Promise.all([this.admin.listAffiliates(), this.admin.listCommissions()]);
    const since = Date.now() - RANKING_DAYS * DAY_MS;
    const totals = new Map<string, number>();
    for (const commission of commissions) {
      if (commission.status === "canceled" || Date.parse(commission.createdAt) < since) continue;
      totals.set(commission.affiliateId, (totals.get(commission.affiliateId) ?? 0) + 1);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([affiliateId, sales], index) => ({
        rank: index + 1,
        displayName: publicAffiliateName(affiliates.find((item) => item.id === affiliateId)?.name ?? "Afiliado"),
        sales,
        isMe: affiliateId === this.affiliateId,
      }));
  }

  async listAnnouncements(): Promise<AffiliateAnnouncement[]> {
    const affiliate = await this.admin.findAffiliate(this.affiliateId);
    return affiliate?.status === "approved" ? sortAnnouncements(await this.admin.listAnnouncements()) : [];
  }
}
