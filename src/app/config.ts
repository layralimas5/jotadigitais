import type { StoreSettings } from "@/domain/store-settings";

export const siteConfig = {
  name: "Jota Digitais",
  url: import.meta.env.VITE_SITE_URL ?? "https://jotadigitais.com.br",
} as const;

/** Valores usados até o Jota salvar as configurações pelo painel (e enquanto elas carregam). */
export const defaultStoreSettings: StoreSettings = {
  whatsappNumber: (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "") || null,
  instagramHandle: "@jotadigitais",
  guaranteeDays: 7,
  pixKey: null,
  pixReceiverName: null,
  pixReceiverCity: null,
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** A chave anon é pública por desenho: quem protege os dados são as políticas RLS do banco. */
/** ID do app do Google (público por desenho): sem ele, o Google Agenda aparece como "falta preparar". */
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim() || null;

export const backendConfig = {
  supabase: supabaseUrl && supabaseAnonKey ? { url: supabaseUrl, anonKey: supabaseAnonKey } : null,
  googleClientId,
} as const;
