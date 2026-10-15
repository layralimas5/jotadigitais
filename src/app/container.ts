import { createClient } from "@supabase/supabase-js";
import type { AdminDeps } from "@/application/admin-use-cases";
import type { UseCaseDeps } from "@/application/use-cases";
import { DemoDatabase } from "@/infrastructure/demo/demo-database";
import {
  DemoAccountRepository,
  DemoOrderRepository,
  DemoStoreSettingsRepository,
  DemoTestimonialRepository,
} from "@/infrastructure/demo/demo-repositories";
import { DemoAuthService, DemoImageStorage } from "@/infrastructure/demo/demo-services";
import { PendingPaymentGateway } from "@/infrastructure/pending-payment-gateway";
import {
  SupabaseAccountRepository,
  SupabaseOrderRepository,
  SupabaseStoreSettingsRepository,
  SupabaseTestimonialRepository,
} from "@/infrastructure/supabase/supabase-repositories";
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
  const accounts = new SupabaseAccountRepository(client);
  const testimonials = new SupabaseTestimonialRepository(client);
  const orders = new SupabaseOrderRepository(client);
  const settings = new SupabaseStoreSettingsRepository(client, defaultStoreSettings);
  return {
    mode: "supabase",
    store: { accounts, testimonials, orders, settings, payments: new PendingPaymentGateway() },
    admin: {
      auth: new SupabaseAuthService(client),
      accounts,
      testimonials,
      orders,
      settings,
      images: new SupabaseImageStorage(client),
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
  return {
    mode: "demo",
    store: { accounts, testimonials, orders, settings, payments: new PendingPaymentGateway() },
    admin: { auth: new DemoAuthService(), accounts, testimonials, orders, settings, images: new DemoImageStorage() },
  };
}

export const container: Container = backendConfig.supabase
  ? supabaseContainer(backendConfig.supabase.url, backendConfig.supabase.anonKey)
  : demoContainer();
