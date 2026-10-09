const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export const siteConfig = {
  name: "Jota Digitais",
  url: import.meta.env.VITE_SITE_URL ?? "https://jotadigitais.com.br",
  instagramUrl: "https://www.instagram.com/jotadigitais",
  instagramHandle: "@jotadigitais",
  whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
  guaranteeDays: 7,
} as const;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

/** A chave anon é pública por desenho: quem protege os dados são as políticas RLS do banco. */
export const backendConfig = {
  supabase: supabaseUrl && supabaseAnonKey ? { url: supabaseUrl, anonKey: supabaseAnonKey } : null,
} as const;
