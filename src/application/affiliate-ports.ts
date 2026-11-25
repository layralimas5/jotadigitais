import type {
  AccountAffiliateRule,
  AccountCommissions,
  Affiliate,
  AffiliateAnnouncement,
  AffiliateAnnouncementData,
  AffiliateClick,
  AffiliateCommission,
  AffiliateCoupon,
  AffiliateMe,
  AffiliateProgram,
  AffiliateProgramData,
  AffiliateSignup,
  AffiliateStatus,
  AffiliateStatusChange,
  CommissionRule,
  RankingEntry,
} from "@/domain/affiliate";
import type {
  AffiliateGift,
  AffiliateGiftClaim,
  AffiliateGiftData,
  AffiliatePayout,
  AffiliateStoreStats,
  AffiliateWhatsAppLead,
} from "@/domain/affiliate-rewards";

/** Programa de afiliados como o Jota administra na aba Parceiros. */
export interface AffiliateAdminRepository {
  getProgram(): Promise<AffiliateProgram>;
  saveProgram(data: AffiliateProgramData): Promise<AffiliateProgram>;
  listAffiliates(): Promise<Affiliate[]>;
  findAffiliate(id: string): Promise<Affiliate | null>;
  /** CPF aberto. Nulo para quem não pode ver (a desenvolvedora). */
  documentOf(id: string): Promise<string | null>;
  changeStatus(id: string, change: AffiliateStatusChange): Promise<void>;
  linkPartner(id: string, partnerId: string | null): Promise<void>;
  removeAffiliate(id: string): Promise<void>;
  listCommissions(): Promise<AffiliateCommission[]>;
  cancelCommission(id: string): Promise<void>;
  listClicks(): Promise<AffiliateClick[]>;
  listCoupons(affiliateId: string): Promise<AffiliateCoupon[]>;
  createCoupon(affiliateId: string, coupon: AffiliateCoupon): Promise<void>;
  listAnnouncements(): Promise<AffiliateAnnouncement[]>;
  saveAnnouncement(id: string | null, data: AffiliateAnnouncementData): Promise<AffiliateAnnouncement>;
  removeAnnouncement(id: string): Promise<void>;
  getAccountRule(accountId: string): Promise<AccountAffiliateRule>;
  /** Regra de todas as contas de uma vez, pelo id (conta sem linha aqui = regra padrão). */
  listAccountRules(): Promise<ReadonlyMap<string, AccountAffiliateRule>>;
  saveAccountRule(accountId: string, rule: AccountAffiliateRule): Promise<void>;
  /** Comissão própria do afiliado (nula volta para a padrão do programa). */
  saveAffiliateCommission(id: string, rule: CommissionRule | null): Promise<void>;
  listPayouts(): Promise<AffiliatePayout[]>;
  /** "Paguei": as comissões escolhidas viram um lote pago. Devolve o id do lote. */
  payCommissions(affiliateId: string, commissionIds: readonly string[], note: string | null): Promise<string>;
  undoPayout(payoutId: string): Promise<void>;
  listGifts(): Promise<AffiliateGift[]>;
  saveGift(id: string | null, data: AffiliateGiftData): Promise<AffiliateGift>;
  removeGift(id: string): Promise<void>;
  listGiftClaims(): Promise<AffiliateGiftClaim[]>;
  setGiftDelivered(giftId: string, affiliateId: string, delivered: boolean): Promise<void>;
  /** Venda atribuída à mão. Devolve quantas comissões nasceram agora (pedido já pago). */
  assignOrder(orderCode: string, affiliateId: string): Promise<number>;
  listWhatsAppLeads(): Promise<AffiliateWhatsAppLead[]>;
  storeStats(days: number): Promise<AffiliateStoreStats>;
}

export type AffiliateAuthState = { status: "signed-out" } | { status: "signed-in"; email: string };

export interface AffiliateProfileUpdate {
  name: string;
  whatsapp: string | null;
  /** Nulo mantém o CPF já gravado. */
  document: string | null;
  pixKey: string | null;
}

export interface AffiliateSignupResult {
  status: AffiliateStatus;
  code: string;
}

/** Painel do afiliado: login próprio, separado do login do painel da loja. */
export interface AffiliatePortalService {
  getProgram(): Promise<AffiliateProgram>;
  signUp(input: AffiliateSignup): Promise<AffiliateSignupResult>;
  getAuthState(): Promise<AffiliateAuthState>;
  onAuthChange(listener: (state: AffiliateAuthState) => void): () => void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
  requestPasswordReset(email: string, redirectTo: string): Promise<void>;
  updatePassword(password: string): Promise<void>;
  /** Nulo: o login existe, mas não é de afiliado. */
  loadMe(): Promise<AffiliateMe | null>;
  myDocument(affiliateId: string): Promise<string | null>;
  updateProfile(update: AffiliateProfileUpdate): Promise<void>;
  listCommissions(): Promise<AffiliateCommission[]>;
  listClicks(): Promise<AffiliateClick[]>;
  accountCommissions(): Promise<AccountCommissions>;
  ranking(days: number): Promise<RankingEntry[]>;
  listAnnouncements(): Promise<AffiliateAnnouncement[]>;
  listPayouts(): Promise<AffiliatePayout[]>;
  listGifts(): Promise<AffiliateGift[]>;
  listGiftClaims(): Promise<AffiliateGiftClaim[]>;
  claimGift(giftId: string): Promise<void>;
  markNoticesSeen(): Promise<void>;
  listWhatsAppLeads(): Promise<AffiliateWhatsAppLead[]>;
  storeStats(days: number): Promise<AffiliateStoreStats>;
}

export interface TrackedClick {
  clickId: string;
  linkDays: number;
}

/** Visitante que chegou por link de afiliado: conta o clique e liga o pedido a ele. */
export interface AffiliateTrackingService {
  track(code: string, accountSlug: string | null): Promise<TrackedClick | null>;
  attach(orderCode: string, clickId: string): Promise<boolean>;
}

export interface AffiliateDeps {
  admin: AffiliateAdminRepository;
  portal: AffiliatePortalService;
  tracking: AffiliateTrackingService;
}
