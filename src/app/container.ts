import { createClient } from "@supabase/supabase-js";
import type { AdminDeps } from "@/application/admin-use-cases";
import type { UseCaseDeps } from "@/application/use-cases";
import { DemoDatabase } from "@/infrastructure/demo/demo-database";
import {
  DemoAccountRepository,
  DemoCustomerRepository,
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
import { GoogleCalendarService } from "@/infrastructure/google-calendar";
import { PendingPaymentGateway } from "@/infrastructure/pending-payment-gateway";
import { DevServerProfileLookupService, SupabaseProfileLookupService } from "@/infrastructure/profile-lookup";
import {
  SupabaseAccountRepository,
  SupabaseCustomerRepository,
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
  SupabaseStoreSettingsRepository,
  SupabaseTestimonialRepository,
} from "@/infrastructure/supabase/supabase-repositories";
import { SupabasePrivacyRepository, SupabasePrivacyService } from "@/infrastructure/supabase/supabase-privacy";
import { PUBLIC_ACCOUNT_COLUMNS } from "@/infrastructure/supabase/rows";
import { SupabaseAuthService, SupabaseImageStorage } from "@/infrastructure/supabase/supabase-services";
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
  return {
    mode: "supabase",
    store: {
      accounts: new SupabaseAccountRepository(client, PUBLIC_ACCOUNT_COLUMNS),
      testimonials,
      orders,
      settings,
      siteContent,
      payments: new PendingPaymentGateway(),
      privacy: new SupabasePrivacyService(client),
    },
    admin: {
      auth: new SupabaseAuthService(client, passwordChecker),
      accounts,
      testimonials,
      orders,
      settings,
      siteContent,
      leads: new SupabaseLeadRepository(client),
      customers: new SupabaseCustomerRepository(client),
      templates: new SupabaseMessageTemplateRepository(client),
      preferences: new SupabasePreferenceRepository(client),
      expenses: new SupabaseExpenseRepository(client),
      revenues: new SupabaseRevenueRepository(client),
      partners: new SupabasePartnerRepository(client),
      users: new SupabaseAdminUserRepository(client),
      profiles: new SupabaseProfileLookupService(client),
      notifications: new SupabaseNotificationRepository(client),
      calendar: new GoogleCalendarService(backendConfig.googleClientId),
      images: new SupabaseImageStorage(client),
      privacy: new SupabasePrivacyRepository(client),
    },
  };
}

/** Sem Supabase configurado, site e painel rodam com dados guardados no próprio navegador. */
function demoContainer(): Container {
  const db = new DemoDatabase();
  const accounts = new DemoAccountRepository(db);
  const testimonials = new DemoTestimonialRepository(db);
  const orders = new DemoOrderRepository(db);
  const settings = new DemoStoreSettingsRepository(db, defaultStoreSettings);
  const siteContent = new DemoSiteContentRepository(db);
  return {
    mode: "demo",
    store: {
      accounts,
      testimonials,
      orders,
      settings,
      siteContent,
      payments: new PendingPaymentGateway(),
      privacy: new DemoPrivacyService(db),
    },
    admin: {
      auth: new DemoAuthService(),
      accounts,
      testimonials,
      orders,
      settings,
      siteContent,
      leads: new DemoLeadRepository(db),
      customers: new DemoCustomerRepository(db),
      templates: new DemoMessageTemplateRepository(db),
      preferences: new DemoPreferenceRepository(db),
      expenses: new DemoExpenseRepository(db),
      revenues: new DemoRevenueRepository(db),
      partners: new DemoPartnerRepository(db),
      users: new DemoAdminUserRepository(db),
      profiles: new DevServerProfileLookupService(),
      notifications: new DemoNotificationRepository(db),
      calendar: new GoogleCalendarService(backendConfig.googleClientId),
      images: new DemoImageStorage(),
      privacy: new DemoPrivacyRepository(db),
    },
  };
}

export const container: Container = backendConfig.supabase
  ? supabaseContainer(backendConfig.supabase.url, backendConfig.supabase.anonKey)
  : demoContainer();
