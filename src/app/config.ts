const whatsappNumber = (import.meta.env.VITE_WHATSAPP_NUMBER ?? "").replace(/\D/g, "");

export const siteConfig = {
  name: "Jota Digitais",
  url: import.meta.env.VITE_SITE_URL ?? "https://jotadigitais.com.br",
  instagramUrl: "https://www.instagram.com/jotadigitais",
  instagramHandle: "@jotadigitais",
  whatsappUrl: whatsappNumber ? `https://wa.me/${whatsappNumber}` : null,
  guaranteeDays: 7,
} as const;
