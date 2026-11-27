import { Eye, Heart, ImageIcon, ThumbsUp, type LucideIcon } from "lucide-react";
import type { FaqTopic } from "@/domain/site-content";
import {
  FULL_SHOP_MIN_FOLLOWERS,
  YOUTUBE_PARTNER_MIN_SUBSCRIBERS,
  YOUTUBE_PARTNER_MIN_WATCH_HOURS,
  followersToFullShop,
  formatCount,
  shopTierOf,
  type Account,
  type AccountOf,
  type AccountSpec,
  type AccountStatus,
  type ShopTier,
} from "@/domain/account";
import {
  descriptionKindOf,
  fillDescriptionTemplate,
  type DescriptionTemplates,
  type DescriptionValues,
} from "@/domain/account-description";
import type { AccountKind } from "@/domain/account-kind";
import { DEFAULT_COUNTRY } from "@/domain/country";
import { MONETIZED_TAG_KEY, SHOP_TAG_KEY, customTagKey } from "@/domain/tag-color";
import { AUDIENCE_LABEL, PLATFORM_LABEL } from "@/domain/platform";
import type { DistributivePick } from "@/shared/types";

// Como cada rede aparece na tela. Toda decisão "o que mostrar para Instagram x YouTube" mora aqui.

export const ACCOUNT_STATUS_LABEL: Record<AccountStatus, string> = {
  available: "Disponível",
  reserved: "Reservada",
  sold: "Vendida",
};

export type BadgeTone = "electric" | "pink" | "emerald" | "mist";

export interface AccountBadge {
  label: string;
  tone: BadgeTone;
  /** Chave da cor que o Jota pode escolher para a tag (ver domain/tag-color). Sem chave, a tag não muda de cor. */
  colorKey?: string;
}

const MONETIZED = (label: string): AccountBadge => ({ label, tone: "emerald", colorKey: MONETIZED_TAG_KEY });

export interface CardMetric {
  icon: LucideIcon;
  text: string;
}

export interface ProfileStat {
  label: string;
  value: string;
}

export type Spec = AccountSpec;

const number = new Intl.NumberFormat("pt-BR");
const date = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });

function youtubeGap(account: AccountOf<"youtube">) {
  return {
    subscribers: Math.max(YOUTUBE_PARTNER_MIN_SUBSCRIBERS - account.followers, 0),
    hours: Math.max(YOUTUBE_PARTNER_MIN_WATCH_HOURS - account.stats.watchHours, 0),
  };
}

export function audienceLabel(account: Pick<Account, "platform">): string {
  return AUDIENCE_LABEL[account.platform];
}

export function verifiedLabel(account: Pick<Account, "platform">): string {
  return account.platform === "tiktok" ? "Central de Criadores ativa" : "Conta conferida pela Jota Digitais";
}

/** A tag principal da conta. No TikTok sem monetização é a situação do Shop (inclusive "Sem TikTok Shop"). */
export function accountBadge(account: Account): AccountBadge | null {
  switch (account.platform) {
    case "tiktok":
      if (account.stats.monetized) return MONETIZED("Monetizada");
      return SHOP_BADGE[shopTierOf(account)];
    case "instagram":
      if (account.stats.monetized) return MONETIZED("Monetizada");
      return account.stats.professional
        ? { label: "Conta profissional", tone: "electric" }
        : { label: "Conta pessoal", tone: "mist" };
    case "youtube":
      return account.stats.monetized
        ? MONETIZED("Monetizado")
        : { label: "Não monetizado", tone: "mist" };
    case "facebook":
      if (account.stats.monetized) return MONETIZED("Monetização ativa");
      return { label: account.stats.kind === "page" ? "Página" : "Perfil", tone: "mist" };
  }
}

const SHOP_BADGE: Record<ShopTier, AccountBadge> = {
  full: { label: "TikTok Shop ativo", tone: "electric", colorKey: SHOP_TAG_KEY.full },
  pilot: { label: "Shop piloto", tone: "pink", colorKey: SHOP_TAG_KEY.pilot },
  none: { label: "Sem TikTok Shop", tone: "mist" },
};

const INSTAGRAM_SHOP_BADGE: AccountBadge = { label: "Instagram Shop", tone: "electric" };

/** TikTok sem Shop nenhum: o card mostra isso em destaque, porque é o que mais gera dúvida na compra. */
export const lacksTiktokShop = (account: Account): boolean => account.platform === "tiktok" && shopTierOf(account) === "none";

const NO_SHOP_TAG_KEY = customTagKey(SHOP_BADGE.none.label);

/** A tag "Sem TikTok Shop", fixa ou criada pelo Jota com o mesmo nome. Some do card quando o aviso em destaque aparece. */
export const isNoShopBadge = (badge: AccountBadge): boolean => customTagKey(badge.label) === NO_SHOP_TAG_KEY;

/** Todas as tags da conta: as fixas (no TikTok, Monetizada e o Shop juntos) e as criadas pelo Jota. */
export function allBadges(account: Account): AccountBadge[] {
  const fixed =
    account.platform === "tiktok"
      ? [account.stats.monetized ? accountBadge(account) : null, SHOP_BADGE[shopTierOf(account)]]
      : account.platform === "instagram" && account.stats.shop
        ? [accountBadge(account), INSTAGRAM_SHOP_BADGE]
        : [accountBadge(account)];
  return [...fixed.filter((badge): badge is AccountBadge => badge !== null), ...account.tags.map((label): AccountBadge => ({ label, tone: "mist", colorKey: customTagKey(label) }))];
}

/**
 * Item do quadro "O que esta conta tem": o que a conta tem (ou não) em cada rede. `text` aponta o texto editável
 * na aba Site (accountPage.<section>.<field>).
 */
export interface StatusItem {
  id: string;
  label: string;
  has: boolean;
  text: StatusText;
  /** Para quem queria outra coisa: o recorte da vitrine com as contas que têm. */
  alternative?: { kind: AccountKind; label: string };
}

export type StatusText =
  | { section: "tiktokStatus"; field: "full" | "pilot" | "none" | "monetized" | "notMonetized" }
  | { section: "instagramStatus"; field: "shop" | "monetized" | "earnings" }
  | { section: "youtubeStatus"; field: "monetized" | "notMonetized" };

const TIKTOK_SHOP_ALTERNATIVE: Partial<Record<ShopTier, StatusItem["alternative"]>> = {
  none: { kind: "tiktok-shop", label: "Ver contas com TikTok Shop" },
  pilot: { kind: "shop-ativo", label: "Ver contas com Shop ativo" },
};

export function statusItemsOf(account: Account): StatusItem[] {
  switch (account.platform) {
    case "tiktok": {
      const tier = shopTierOf(account);
      const shop: StatusItem = {
        id: tier,
        label: SHOP_BADGE[tier].label,
        has: tier !== "none",
        text: { section: "tiktokStatus", field: tier },
        alternative: TIKTOK_SHOP_ALTERNATIVE[tier],
      };
      const monetization: StatusItem = account.stats.monetized
        ? { id: "monetized", label: "Monetizada", has: true, text: { section: "tiktokStatus", field: "monetized" } }
        : {
            id: "not-monetized",
            label: "Não monetizada",
            has: false,
            text: { section: "tiktokStatus", field: "notMonetized" },
            alternative: { kind: "tiktok-monetizada", label: "Ver contas monetizadas" },
          };
      return [shop, monetization];
    }
    case "instagram": {
      // A pedido do Jota: no Instagram, "sem Shop" e "não monetizada" não vendem. Mostra o que a conta tem
      // e sempre as formas de ganhar com ela (publi, afiliado, anúncios).
      const items: StatusItem[] = [];
      if (account.stats.shop) {
        items.push({ id: "shop", label: "Instagram Shop ativo", has: true, text: { section: "instagramStatus", field: "shop" } });
      }
      if (account.stats.monetized) {
        items.push({ id: "monetized", label: "Monetizada", has: true, text: { section: "instagramStatus", field: "monetized" } });
      }
      items.push({
        id: "earnings",
        label: "Formas de ganhar com a conta",
        has: true,
        text: { section: "instagramStatus", field: "earnings" },
        alternative: !account.stats.shop
          ? { kind: "instagram-shop", label: "Ver contas com Instagram Shop" }
          : !account.stats.monetized
            ? { kind: "instagram-monetizada", label: "Ver contas monetizadas" }
            : undefined,
      });
      return items;
    }
    case "youtube":
      return [
        account.stats.monetized
          ? { id: "monetized", label: "Monetizado", has: true, text: { section: "youtubeStatus", field: "monetized" } }
          : {
              id: "not-monetized",
              label: "Não monetizado",
              has: false,
              text: { section: "youtubeStatus", field: "notMonetized" },
              alternative: { kind: "youtube-monetizado", label: "Ver canais monetizados" },
            },
      ];
    case "facebook":
      return [];
  }
}

/** Como a galeria da página da conta se organiza: se entra a Central ilustrativa e o nome de cada print. */
export interface GalleryPlan {
  /** Imagem ilustrativa da Central de Criadores (TikTok com Shop, sem monetização). */
  showCentral: boolean;
  /**
   * Nome de cada print, na ordem em que o Jota sobe. No TikTok e no Instagram o primeiro é a tela do perfil;
   * no YouTube o Jota abre pelo painel do Studio. Os que passarem da lista viram "Outras informações N".
   */
  printLabels: readonly string[];
}

/** Abas focadas por tipo de conta, do jeito que o Jota anuncia cada uma. */
export function galleryPlanOf(account: { platform: Account["platform"]; monetized: boolean; hasShop?: boolean }): GalleryPlan {
  switch (account.platform) {
    case "tiktok":
      return account.monetized
        ? { showCentral: false, printLabels: ["Print do perfil", "Monetização", "Informações", "Outras informações"] }
        : { showCentral: account.hasShop ?? true, printLabels: ["Print do perfil", "Informações", "Outras informações"] };
    case "youtube":
      return account.monetized
        ? { showCentral: false, printLabels: ["Receita", "Monetizações", "Informações"] }
        : { showCentral: false, printLabels: ["Resumos", "Informações", "Outras informações"] };
    case "instagram":
      return { showCentral: false, printLabels: ["Print do perfil", "Receita", "Análises", "Informações"] };
    case "facebook":
      return { showCentral: false, printLabels: [] };
  }
}

const EXTRA_PRINTS = "Outras informações";

/**
 * Nome do print na posição. Os que passam da lista entram como "Outras informações" (2, 3...), a última aba do
 * padrão do Jota; rede sem padrão (Facebook) continua com "Print N".
 */
export function printLabelOf(plan: GalleryPlan, index: number): string {
  const named = plan.printLabels[index];
  if (named) return named;
  if (plan.printLabels.length === 0) return `Print ${index + 1}`;
  const extrasBefore = plan.printLabels.filter((label) => label === EXTRA_PRINTS).length;
  const number = extrasBefore + (index - plan.printLabels.length) + 1;
  return number === 1 ? EXTRA_PRINTS : `${EXTRA_PRINTS} ${number}`;
}

export function cardMetric(account: Account): CardMetric {
  switch (account.platform) {
    case "tiktok":
      return { icon: Heart, text: `${formatCount(account.stats.likes)} curtidas` };
    case "instagram":
      return { icon: ImageIcon, text: `${formatCount(account.stats.posts)} publicações` };
    case "youtube":
      return { icon: Eye, text: `${formatCount(account.stats.views)} visualizações` };
    case "facebook":
      return { icon: ThumbsUp, text: `${formatCount(account.stats.likes)} curtidas` };
  }
}

/** O mínimo para desenhar os números de um perfil: serve para a conta real e para a prévia do hero. */
export type AudienceSnapshot = DistributivePick<Account, "platform" | "stats" | "followers">;

/** Três números do topo do perfil, na ordem em que a própria rede mostra. */
export function profileStats(account: AudienceSnapshot): ProfileStat[] {
  switch (account.platform) {
    case "tiktok":
      return [
        { label: "Seguindo", value: formatCount(account.stats.following) },
        { label: "Seguidores", value: formatCount(account.followers) },
        { label: "Curtidas", value: formatCount(account.stats.likes) },
      ];
    case "instagram":
      return [
        { label: "Publicações", value: formatCount(account.stats.posts) },
        { label: "Seguidores", value: formatCount(account.followers) },
        { label: "Seguindo", value: formatCount(account.stats.following) },
      ];
    case "youtube":
      return [
        { label: "Inscritos", value: formatCount(account.followers) },
        { label: "Vídeos", value: formatCount(account.stats.videos) },
        { label: "Visualizações", value: formatCount(account.stats.views) },
      ];
    case "facebook":
      return [
        { label: "Seguidores", value: formatCount(account.followers) },
        { label: "Curtidas", value: formatCount(account.stats.likes) },
        { label: "Monetização", value: account.stats.monetized ? "Ativa" : "Inativa" },
      ];
  }
}

function platformSpecs(account: Account): Spec[] {
  switch (account.platform) {
    case "tiktok":
      return [
        { label: "Seguidores", value: number.format(account.followers) },
        { label: "Curtidas", value: number.format(account.stats.likes) },
        { label: "Seguindo", value: number.format(account.stats.following) },
        {
          label: "TikTok Shop",
          value:
            shopTierOf(account) === "none"
              ? "Não ativado"
              : shopTierOf(account) === "full"
              ? "Ativo, com todos os produtos liberados"
              : followersToFullShop(account) > 0
                ? `Piloto (completo a partir de ${number.format(FULL_SHOP_MIN_FOLLOWERS)} seguidores, faltam ${number.format(followersToFullShop(account))})`
                : "Piloto",
        },
        { label: "Monetização", value: account.stats.monetized ? "Ativa" : "Não ativa" },
      ];
    case "instagram":
      return [
        { label: "Seguidores", value: number.format(account.followers) },
        { label: "Publicações", value: number.format(account.stats.posts) },
        { label: "Seguindo", value: number.format(account.stats.following) },
        { label: "Tipo de conta", value: account.stats.professional ? "Profissional" : "Pessoal" },
        { label: "Instagram Shop", value: account.stats.shop ? "Ativo" : "Não ativado" },
        { label: "Monetização", value: account.stats.monetized ? "Ativa" : "Não ativa" },
      ];
    case "youtube": {
      const gap = youtubeGap(account);
      const partner = account.stats.monetized
        ? "Monetizado"
        : [
            "Ainda não monetizado",
            gap.subscribers > 0 ? `faltam ${number.format(gap.subscribers)} inscritos` : null,
            gap.hours > 0 ? `faltam ${number.format(gap.hours)} horas` : null,
          ]
            .filter(Boolean)
            .join(", ");
      return [
        { label: "Inscritos", value: number.format(account.followers) },
        { label: "Visualizações", value: number.format(account.stats.views) },
        { label: "Vídeos publicados", value: number.format(account.stats.videos) },
        { label: "Horas de exibição (12 meses)", value: number.format(account.stats.watchHours) },
        { label: "Programa de Parcerias", value: partner },
      ];
    }
    case "facebook":
      return [
        { label: "Tipo", value: account.stats.kind === "page" ? "Página" : "Perfil" },
        { label: "Seguidores", value: number.format(account.followers) },
        { label: "Curtidas", value: number.format(account.stats.likes) },
        { label: "Monetização", value: account.stats.monetized ? "Ativa" : "Inativa" },
      ];
  }
}

/** Ficha técnica da página da conta: a escrita na ficha da conta ou, sem ela, a automática. */
export function specsOf(account: Account, fixedSpecs: Record<Account["platform"], readonly Spec[]>): Spec[] {
  return account.specs ?? automaticSpecsOf(account, fixedSpecs);
}

/** Rede, nicho e números saem de cada conta; as linhas fixas vêm da aba Site. */
export function automaticSpecsOf(account: Account, fixedSpecs: Record<Account["platform"], readonly Spec[]>): Spec[] {
  return [
    { label: "Rede", value: PLATFORM_LABEL[account.platform] },
    { label: "País", value: account.countryName },
    ...(account.niche ? [{ label: "Nicho atual", value: account.niche }] : []),
    ...platformSpecs(account),
    ...fixedSpecs[account.platform],
    { label: "Anunciada em", value: date.format(new Date(account.listedAt)) },
  ];
}

function platformParagraph(account: Account): string {
  switch (account.platform) {
    case "tiktok": {
      const monetization = account.stats.monetized ? "A conta é monetizada: já recebe pelo Programa de Recompensas para Criadores. " : "";
      const tier = shopTierOf(account);
      const shop =
        tier === "none"
          ? "Esta conta não tem o TikTok Shop: não vende produtos como afiliada pelo TikTok."
          : tier === "pilot"
            ? "O Shop está em modo piloto. Funciona normalmente; alguns produtos liberam conforme a conta cresce."
            : "A conta já passou do modo piloto: todos os produtos do TikTok Shop estão disponíveis para afiliação.";
      return (monetization + shop).trim();
    }
    case "instagram":
      return account.stats.professional
        ? "É uma conta profissional: você já tem o painel com alcance, visitas ao perfil e dados do público para planejar o conteúdo."
        : "É uma conta pessoal. Você pode transformá-la em profissional em poucos toques depois da compra, sem perder seguidores.";
    case "youtube": {
      if (account.stats.monetized) return "O canal está no Programa de Parcerias do YouTube e já pode receber pela exibição de anúncios.";
      const gap = youtubeGap(account);
      return `O canal ainda não é monetizado. Para entrar no Programa de Parcerias faltam ${number.format(gap.subscribers)} inscritos e ${number.format(gap.hours)} horas de exibição.`;
    }
    case "facebook":
      return account.stats.kind === "page"
        ? `É uma página: você passa a ser administrador total${account.stats.monetized ? ", com a monetização já ativa" : ""}.`
        : `É um perfil${account.stats.monetized ? " com a monetização já ativa" : ""}. Você recebe o acesso completo para trocar nome e foto.`;
  }
}

/** Texto montado no código com os dados da conta: vale quando o modelo do tipo de conta está em branco na aba Site. */
export function builtInDescriptionOf(account: Account): string {
  const intro = `Conta de ${PLATFORM_LABEL[account.platform]}${account.niche ? ` de ${account.niche.toLowerCase()}` : ""} com ${number.format(account.followers)} ${audienceLabel(account).toLowerCase()}. Depois da compra você troca nome, @ e foto e começa a publicar.`;
  const details = platformParagraph(account);
  return details ? `${intro}\n\n${details}` : intro;
}

function likesOf(account: Account): number | null {
  if (account.platform === "tiktok" || account.platform === "facebook") return account.stats.likes;
  return null;
}

function descriptionValuesOf(account: Account): DescriptionValues {
  const likes = likesOf(account);
  return {
    rede: PLATFORM_LABEL[account.platform],
    nicho: account.niche?.toLowerCase() ?? "",
    seguidores: number.format(account.followers),
    curtidas: likes === null ? "" : number.format(likes),
    pais: account.countryName,
  };
}

/** Texto de quando o Jota não escreveu um próprio: o modelo do tipo de conta (aba Site) ou, sem modelo, o montado no código. */
export function automaticDescriptionOf(account: Account, templates: DescriptionTemplates): string {
  const template = templates[descriptionKindOf(account)].trim();
  return template ? fillDescriptionTemplate(template, descriptionValuesOf(account)) : builtInDescriptionOf(account);
}

/** "Sobre esta conta" em parágrafos: o texto escrito no painel ou o automático. Linha em branco separa parágrafos. */
export function descriptionOf(account: Account, templates: DescriptionTemplates): string[] {
  return (account.description ?? automaticDescriptionOf(account, templates))
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Itens que dependem dos dados da conta (monetização, Shop, conta profissional, página ou perfil): entram sozinhos. */
function automaticIncluded(account: Account): string[] {
  switch (account.platform) {
    case "tiktok":
      return [
        ...(account.stats.monetized ? ["Monetização ativa"] : []),
        ...(shopTierOf(account) !== "none" ? [TIKTOK_SHOP_INCLUDED] : []),
      ];
    case "instagram":
      return [
        ...(account.stats.professional ? ["Conta profissional com estatísticas"] : []),
        ...(account.stats.shop ? ["Loja do Instagram (Instagram Shop) ativa"] : []),
        ...(account.stats.monetized ? ["Monetização ativa"] : []),
      ];
    case "youtube":
      return account.stats.monetized ? ["Programa de Parcerias ativo"] : [];
    case "facebook":
      return [
        account.stats.kind === "page" ? "Acesso de administrador total à página" : "Acesso completo ao perfil",
        ...(account.stats.monetized ? ["Monetização ativa"] : []),
      ];
  }
}

const TIKTOK_SHOP_INCLUDED = "Central de Criadores do TikTok Shop ativa";

/** Linha fixa que fala do Shop: agora ele entra sozinho, só na conta que tem (a aba Site pode ter a linha antiga salva). */
const SHOP_LINE = /tiktok shop|central de criadores/i;

/** "Seguidores reais e brasileiros" só vale para conta do Brasil; nas outras fica "Seguidores reais". */
const BRAZILIAN_AUDIENCE = /\s+e\s+brasileiros\b/i;

function fixedIncludedOf(account: Account, items: readonly string[]): string[] {
  return items
    .filter((item) => !(account.platform === "tiktok" && SHOP_LINE.test(item)))
    .map((item) => (account.country === DEFAULT_COUNTRY ? item : item.replace(BRAZILIAN_AUDIENCE, "")));
}

/** "O que está incluso": os itens automáticos da conta e depois os da rede, editados na aba Site, ajustados à conta. */
export function includedOf(account: Account, fixedByPlatform: Record<Account["platform"], string[]>): string[] {
  return [...automaticIncluded(account), ...fixedIncludedOf(account, fixedByPlatform[account.platform])];
}

/** Pergunta das Dúvidas que explica cada item do quadro "O que esta conta tem" (o link "Entenda"). */
export function statusTopicOf(platform: Account["platform"], item: Pick<StatusItem, "id">): FaqTopic | null {
  const monetization = item.id === "monetized" || item.id === "not-monetized" || item.id === "earnings";
  switch (platform) {
    case "tiktok":
      if (monetization) return "tiktok-monetized";
      return item.id === "pilot" ? "tiktok-shop-pilot" : "tiktok-shop-full";
    case "instagram":
      return monetization ? "instagram-monetized" : "instagram-shop";
    case "youtube":
      return "youtube-monetized";
    case "facebook":
      return null;
  }
}
