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
  RankingEntry,
} from "@/domain/affiliate";

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
