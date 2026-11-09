import { DemoCouponRepository, DemoCouponService } from "@/infrastructure/demo/demo-coupons";
import { SupabaseCouponRepository, SupabaseCouponService } from "@/infrastructure/supabase/supabase-coupons";
import { createClient } from "@supabase/supabase-js";
import type { AdminDeps } from "@/application/admin-use-cases";
import type { UseCaseDeps } from "@/application/use-cases";
import { DemoDatabase } from "@/infrastructure/demo/demo-database";
import { DemoLegalDocumentRepository } from "@/infrastructure/demo/demo-legal";
import {
  DemoAccountRepository,
  DemoCustomerRepository,
  DemoEmailAccountRepository,
  DemoExpenseRepository,
  DemoLeadRepository,
  DemoMessageTemplateRepository,
  DemoNotificationRepository,
  DemoAdminUserRepository,
  DemoOrderRepository,
  DemoPartnerRepository,
  DemoPreferenceRepository,
  DemoRevenueRepository,
  DemoSiteContentRepository,
  DemoStoreSettingsRepository,
  DemoTestimonialRepository,
} from "@/infrastructure/demo/demo-repositories";
import { DemoPrivacyRepository, DemoPrivacyService } from "@/infrastructure/demo/demo-privacy";
import { DemoAuthService, DemoImageStorage } from "@/infrastructure/demo/demo-services";
import { DemoSupportTicketRepository } from "@/infrastructure/demo/demo-support";
import { DemoAccessRepository } from "@/infrastructure/demo/demo-access";
import { GoogleCalendarService } from "@/infrastructure/google-calendar";
import { DemoPaymentGateway } from "@/infrastructure/demo/demo-payment-gateway";
import { SupabasePaymentGateway } from "@/infrastructure/supabase/supabase-payment-gateway";
import { DevServerProfileLookupService, SupabaseProfileLookupService } from "@/infrastructure/profile-lookup";
import {
  SupabaseAccountRepository,
  SupabaseCustomerRepository,
  SupabaseEmailAccountRepository,
  SupabaseExpenseRepository,
  SupabaseLeadRepository,
  SupabaseMessageTemplateRepository,
  SupabaseNotificationRepository,
  SupabaseAdminUserRepository,
  SupabaseOrderRepository,
  SupabasePartnerRepository,
  SupabasePreferenceRepository,
  SupabaseRevenueRepository,
  SupabaseSiteContentRepository,
  SupabaseLegalDocumentRepository,
  SupabaseStoreSettingsRepository,
  SupabaseTestimonialRepository,
} from "@/infrastructure/supabase/supabase-repositories";
import { SupabasePrivacyRepository, SupabasePrivacyService } from "@/infrastructure/supabase/supabase-privacy";
import { PUBLIC_ACCOUNT_COLUMNS } from "@/infrastructure/supabase/rows";
import { SupabaseAuthService, SupabaseImageStorage } from "@/infrastructure/supabase/supabase-services";
import { SupabaseSupportTicketRepository } from "@/infrastructure/supabase/supabase-support";
import { SupabaseAccessRepository } from "@/infrastructure/supabase/supabase-access";
import { backendConfig, defaultStoreSettings } from "./config";

export type BackendMode = "supabase" | "demo";

interface Container {
  mode: BackendMode;
  store: UseCaseDeps;
  admin: AdminDeps;
}

function supabaseContainer(url: string, anonKey: string): Container {
  const client = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const passwordChecker = () =>
    createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: "jd-password-check" },
    });
  const accounts = new SupabaseAccountRepository(client);
  const testimonials = new SupabaseTestimonialRepository(client);
  const orders = new SupabaseOrderRepository(client);
  const settings = new SupabaseStoreSettingsRepository(client, defaultStoreSettings);
  const siteContent = new SupabaseSiteContentRepository(client);
  const legal = new SupabaseLegalDocumentRepository(client);
  return {
    mode: "supabase",
    store: {
      accounts: new SupabaseAccountRepository(client, PUBLIC_ACCOUNT_COLUMNS),
      testimonials,
      orders,
      settings,
      siteContent,
      legal,
      payments: new SupabasePaymentGateway(client),
      privacy: new SupabasePrivacyService(client),
      coupons: new SupabaseCouponService(client),
    },
    admin: {
      auth: new SupabaseAuthService(client, passwordChecker),
      accounts,
      testimonials,
      orders,
      settings,
      siteContent,
      legal,
      leads: new SupabaseLeadRepository(client),
      customers: new SupabaseCustomerRepository(client),
      templates: new SupabaseMessageTemplateRepository(client),
      preferences: new SupabasePreferenceRepository(client),
      expenses: new SupabaseExpenseRepository(client),
      revenues: new SupabaseRevenueRepository(client),
      partners: new SupabasePartnerRepository(client),
      emailAccounts: new SupabaseEmailAccountRepository(client),
      coupons: new SupabaseCouponRepository(client),
      users: new SupabaseAdminUserRepository(client),
      profiles: new SupabaseProfileLookupService(client),
      notifications: new SupabaseNotificationRepository(client),
      calendar: new GoogleCalendarService(backendConfig.googleClientId),
      images: new SupabaseImageStorage(client),
      privacy: new SupabasePrivacyRepository(client),
      support: new SupabaseSupportTicketRepository(client),
      access: new SupabaseAccessRepository(client),
    },
  };
}

/** Painel inteiro sobre um banco de exemplo no navegador: o modo demonstração e o ambiente de teste usam o mesmo. */
function demoAdminDeps(db: DemoDatabase, authKeyPrefix?: string) {
  const users = new DemoAdminUserRepository(db);
  const auth = new DemoAuthService((email) => users.accessOf(email), authKeyPrefix);
  const store = {
    accounts: new DemoAccountRepository(db),
    testimonials: new DemoTestimonialRepository(db),
    orders: new DemoOrderRepository(db),
    settings: new DemoStoreSettingsRepository(db, defaultStoreSettings),
    siteContent: new DemoSiteContentRepository(db),
    legal: new DemoLegalDocumentRepository(db),
  };
  const admin: AdminDeps = {
    auth,
    ...store,
    leads: new DemoLeadRepository(db),
    customers: new DemoCustomerRepository(db),
    templates: new DemoMessageTemplateRepository(db),
    preferences: new DemoPreferenceRepository(db),
    expenses: new DemoExpenseRepository(db),
    revenues: new DemoRevenueRepository(db),
    partners: new DemoPartnerRepository(db),
    emailAccounts: new DemoEmailAccountRepository(db),
    coupons: new DemoCouponRepository(db),
    users,
    profiles: new DevServerProfileLookupService(),
    notifications: new DemoNotificationRepository(db),
    calendar: new GoogleCalendarService(backendConfig.googleClientId),
    images: new DemoImageStorage(),
    privacy: new DemoPrivacyRepository(db),
    support: new DemoSupportTicketRepository(db, auth),
    access: new DemoAccessRepository(db, users, auth),
  };
  return { store, admin };
}

/** Sem Supabase configurado, site e painel rodam com dados guardados no próprio navegador. */
function demoContainer(): Container {
  const db = new DemoDatabase();
  const { store, admin } = demoAdminDeps(db);
  return {
    mode: "demo",
    store: { ...store, payments: new DemoPaymentGateway(store.orders), privacy: new DemoPrivacyService(db), coupons: new DemoCouponService(db) },
    admin,
  };
}

/** Onde o ambiente de teste guarda os dados de exemplo. Recomeçar o teste apaga só esta chave. */
export const SANDBOX_STORAGE_KEY = "jota:sandbox-db";

let sandbox: AdminDeps | null = null;

/**
 * "Testar como o Jota": o painel dele sobre dados de exemplo só deste navegador, com o login de exemplo do Jota.
 * Tudo funciona (abrir e aprovar chamado, cadastrar, entregar) e nada encosta no banco de verdade.
 */
export function sandboxAdminDeps(): AdminDeps {
  sandbox ??= demoAdminDeps(new DemoDatabase(SANDBOX_STORAGE_KEY), "jota:sandbox").admin;
  return sandbox;
}

export const container: Container = backendConfig.supabase
  ? supabaseContainer(backendConfig.supabase.url, backendConfig.supabase.anonKey)
  : demoContainer();
