import type { Account } from "@/domain/account";
import type { StoredNotification } from "@/domain/notification";
import type { Testimonial } from "@/domain/testimonial";
import type { DistributiveOmit } from "@/shared/types";

type SeedAccount = DistributiveOmit<Account, "reservedUntil" | "description" | "images" | "avatarUrl" | "partnerId" | "profileUrl" | "statsSyncedAt">;

function account(seed: SeedAccount): Account {
  return { description: null, avatarUrl: null, images: [], reservedUntil: null, partnerId: null, profileUrl: null, statsSyncedAt: null, ...seed };
}

/** Estoque de demonstração com perfis fictícios. Só aparece quando o Supabase não está configurado. */
export const SEED_ACCOUNTS: Account[] = [
  account({ id: "acc_01", slug: "achadinhos-da-bia", platform: "tiktok", displayName: "Achadinhos da Bia", handle: "@achadinhos.dabia", niche: "Moda", followers: 1259, stats: { likes: 2123, following: 0, monetized: false }, price: 37000, status: "available", listedAt: "2026-10-01" }),
  account({ id: "acc_02", slug: "noticias-agora", platform: "tiktok", displayName: "Notícias Agora", handle: "@noticias.agora.br", niche: "Notícias", followers: 1007, stats: { likes: 1735, following: 0, monetized: false }, price: 37000, status: "available", listedAt: "2026-10-01" }),
  account({ id: "acc_03", slug: "casa-pratica", platform: "tiktok", displayName: "Casa Prática", handle: "@casapratica.oficial", niche: "Casa", followers: 1093, stats: { likes: 8818, following: 7, monetized: false }, price: 37000, status: "available", listedAt: "2026-09-30" }),
  account({ id: "acc_04", slug: "glow-diario-ig", platform: "instagram", displayName: "Glow Diário", handle: "@glow.diario", niche: "Beleza", followers: 8420, stats: { posts: 112, following: 210, professional: true, monetized: true }, price: 59000, status: "available", listedAt: "2026-09-30" }),
  account({ id: "acc_05", slug: "receita-rapida-yt", platform: "youtube", displayName: "Receita Rápida", handle: "@receitarapida", niche: "Culinária", followers: 12400, stats: { views: 1_480_000, videos: 86, watchHours: 5200, monetized: true }, price: 249000, status: "available", listedAt: "2026-09-29" }),
  account({ id: "acc_06", slug: "rindo-a-toa", platform: "tiktok", displayName: "Rindo à Toa", handle: "@rindo.atoa", niche: "Humor", followers: 1388, stats: { likes: 12450, following: 3, monetized: false }, price: 37000, status: "reserved", listedAt: "2026-09-28" }),
  account({ id: "acc_07", slug: "pet-feliz-fb", platform: "facebook", displayName: "Pet Feliz Brasil", handle: "@petfelizbrasil", niche: "Pets", followers: 15800, stats: { kind: "page", likes: 14200, monetized: true }, price: 89000, status: "available", listedAt: "2026-09-27" }),
  account({ id: "acc_08", slug: "tech-de-bolso", platform: "tiktok", displayName: "Tech de Bolso", handle: "@techdebolso", niche: "Tecnologia", followers: 2310, stats: { likes: 15820, following: 4, monetized: true }, price: 47000, status: "available", listedAt: "2026-09-26" }),
  account({ id: "acc_09", slug: "treino-em-casa-ig", platform: "instagram", displayName: "Treino em Casa", handle: "@treino.emcasa.br", niche: "Fitness", followers: 4130, stats: { posts: 64, following: 98, professional: true, monetized: false }, price: 42000, status: "available", listedAt: "2026-09-25" }),
  account({ id: "acc_10", slug: "games-sem-filtro", platform: "youtube", displayName: "Games sem Filtro", handle: "@gamessemfiltro", niche: "Games", followers: 1850, stats: { views: 96_300, videos: 41, watchHours: 2740, monetized: false }, price: 69000, status: "available", listedAt: "2026-09-24" }),
  account({ id: "acc_11", slug: "look-do-dia", platform: "tiktok", displayName: "Look do Dia", handle: "@lookdodia.br", niche: "Moda", followers: 3420, stats: { likes: 28900, following: 5, monetized: false }, price: 59000, status: "available", listedAt: "2026-09-21" }),
  account({ id: "acc_12", slug: "vida-leve", platform: "instagram", displayName: "Vida Leve", handle: "@vidaleve.diario", niche: "Lifestyle", followers: 2290, stats: { posts: 47, following: 150, professional: false, monetized: false }, price: 29000, status: "sold", listedAt: "2026-09-20" }),
  account({ id: "acc_13", slug: "ofertas-do-dia-fb", platform: "facebook", displayName: "Ofertas do Dia", handle: "@ofertasdodia.br", niche: "Promoções", followers: 6100, stats: { kind: "page", likes: 5900, monetized: false }, price: 39000, status: "available", listedAt: "2026-09-19" }),
];

export const SEED_TESTIMONIALS: Testimonial[] = [
  { id: "tst_01", kind: "result", title: "R$ 23,5 mil no mês", subtitle: "Marina, em comissões", imageUrl: "/images/depoimento-marina.webp", imageAlt: "WhatsApp da cliente Marina com o painel do TikTok Shop: R$ 23,5 mil em comissões estimadas no mês.", width: 553, height: 1200, position: 0, published: true },
  { id: "tst_02", kind: "delivered", title: "Shop para criadores ativo", subtitle: "1.093 seguidores", imageUrl: "/images/conta-entregue-1.webp", imageAlt: "Perfil de conta entregue com a aba TikTok Shop para criadores ativa e 1.093 seguidores.", width: 540, height: 1063, position: 1, published: true },
  { id: "tst_03", kind: "result", title: "R$ 2,9 mil em um dia", subtitle: "Taah, em comissões", imageUrl: "/images/depoimento-taah.webp", imageAlt: "WhatsApp da cliente Taah com o painel do TikTok Shop: R$ 2,9 mil em comissões estimadas no dia.", width: 553, height: 1200, position: 2, published: true },
  { id: "tst_04", kind: "delivered", title: "Pagamentos do Shop liberados", subtitle: "1.129 seguidores", imageUrl: "/images/conta-entregue-2.webp", imageAlt: "Perfil de conta entregue com a opção Comece a receber pagamentos do TikTok Shop e 1.129 seguidores.", width: 540, height: 1063, position: 3, published: true },
  { id: "tst_05", kind: "delivered", title: "Vitrine e link de afiliado", subtitle: "1.517 seguidores", imageUrl: "/images/conta-entregue-3.webp", imageAlt: "Perfil de conta entregue com a vitrine ativa, link de afiliado e 1.517 seguidores.", width: 540, height: 1063, position: 4, published: true },
  { id: "tst_06", kind: "delivered", title: "Pronta para vender", subtitle: "1.061 seguidores", imageUrl: "/images/conta-entregue-4.webp", imageAlt: "Perfil de conta entregue com a opção Comece a receber pagamentos do TikTok Shop e 1.061 seguidores.", width: 540, height: 1063, position: 5, published: true },
];

/** Novidades do sistema no sininho. Com o Supabase, as mesmas entram pela migration de notificações. */
export const SEED_NEWS: StoredNotification[] = [
  {
    id: "news_01",
    kind: "news",
    title: "Novo: conecte seu Google Agenda",
    body: "Em Conexões, ligue sua agenda e mande os retornos do CRM para o celular.",
    link: "/admin/apis",
    createdAt: "2026-10-15T12:00:00.000Z",
  },
  {
    id: "news_02",
    kind: "news",
    title: "Novo: puxe os dados da conta pelo link",
    body: "Na ficha da conta, cole o link do perfil e o sistema preenche seguidores, curtidas e foto.",
    link: "/admin/contas",
    createdAt: "2026-10-15T11:00:00.000Z",
  },
  {
    id: "news_03",
    kind: "news",
    title: "Novo: envie uma conta pelo WhatsApp",
    body: "O botão verde em cada conta monta a mensagem com os números, o preço e o link de compra.",
    link: "/admin/contas",
    createdAt: "2026-10-15T10:00:00.000Z",
  },
];
