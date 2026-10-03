import type { TikTokAccount } from "@/domain/account";

/**
 * Estoque de demonstração com perfis fictícios. Substituir pelo estoque real
 * quando o repositório passar a ler do banco.
 */
export const SEED_ACCOUNTS: TikTokAccount[] = [
  { id: "acc_01", slug: "achadinhos-da-bia", displayName: "Achadinhos da Bia", handle: "@achadinhos.dabia", niche: "Moda", followers: 1259, likes: 2123, following: 0, price: 37000, status: "available", listedAt: "2026-10-01" },
  { id: "acc_02", slug: "noticias-agora", displayName: "Notícias Agora", handle: "@noticias.agora.br", niche: "Notícias", followers: 1007, likes: 1735, following: 0, price: 37000, status: "available", listedAt: "2026-10-01" },
  { id: "acc_03", slug: "casa-pratica", displayName: "Casa Prática", handle: "@casapratica.oficial", niche: "Casa", followers: 1093, likes: 8818, following: 7, price: 37000, status: "available", listedAt: "2026-09-30" },
  { id: "acc_04", slug: "glow-diario", displayName: "Glow Diário", handle: "@glow.diario", niche: "Beleza", followers: 1020, likes: 1056, following: 7, price: 37000, status: "available", listedAt: "2026-09-29" },
  { id: "acc_05", slug: "rindo-a-toa", displayName: "Rindo à Toa", handle: "@rindo.atoa", niche: "Humor", followers: 1388, likes: 12450, following: 3, price: 37000, status: "reserved", listedAt: "2026-09-28" },
  { id: "acc_06", slug: "treino-em-casa", displayName: "Treino em Casa", handle: "@treino.emcasa.br", niche: "Fitness", followers: 1146, likes: 3970, following: 2, price: 37000, status: "available", listedAt: "2026-09-27" },
  { id: "acc_07", slug: "tech-de-bolso", displayName: "Tech de Bolso", handle: "@techdebolso", niche: "Tecnologia", followers: 2310, likes: 15820, following: 4, price: 47000, status: "available", listedAt: "2026-09-26" },
  { id: "acc_08", slug: "pet-feliz", displayName: "Pet Feliz", handle: "@petfeliz.brasil", niche: "Pets", followers: 1512, likes: 6304, following: 1, price: 37000, status: "available", listedAt: "2026-09-25" },
  { id: "acc_09", slug: "receita-rapida", displayName: "Receita Rápida", handle: "@receita.rapida.br", niche: "Culinária", followers: 2780, likes: 21540, following: 6, price: 52000, status: "available", listedAt: "2026-09-24" },
  { id: "acc_10", slug: "vida-leve", displayName: "Vida Leve", handle: "@vidaleve.diario", niche: "Lifestyle", followers: 1184, likes: 2840, following: 0, price: 37000, status: "sold", listedAt: "2026-09-22" },
  { id: "acc_11", slug: "look-do-dia", displayName: "Look do Dia", handle: "@lookdodia.br", niche: "Moda", followers: 3420, likes: 28900, following: 5, price: 59000, status: "available", listedAt: "2026-09-21" },
  { id: "acc_12", slug: "make-sem-misterio", displayName: "Make sem Mistério", handle: "@makesemmisterio", niche: "Beleza", followers: 1675, likes: 9210, following: 2, price: 37000, status: "available", listedAt: "2026-09-20" },
];
