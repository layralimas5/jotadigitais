import { Eye, Heart, ImageIcon, ThumbsUp, type LucideIcon } from "lucide-react";
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
} from "@/domain/account";
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
}

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

export function accountBadge(account: Account): AccountBadge {
  switch (account.platform) {
    case "tiktok":
      if (account.stats.monetized) return { label: "Monetizada", tone: "emerald" };
      return shopTierOf(account) === "full"
        ? { label: "TikTok Shop ativo", tone: "electric" }
        : { label: "Shop piloto", tone: "pink" };
    case "instagram":
      if (account.stats.monetized) return { label: "Monetizada", tone: "emerald" };
      return account.stats.professional
        ? { label: "Conta profissional", tone: "electric" }
        : { label: "Conta pessoal", tone: "mist" };
    case "youtube":
      return account.stats.monetized
        ? { label: "Monetizado", tone: "emerald" }
        : { label: "Não monetizado", tone: "mist" };
    case "facebook":
      if (account.stats.monetized) return { label: "Monetização ativa", tone: "emerald" };
      return { label: account.stats.kind === "page" ? "Página" : "Perfil", tone: "mist" };
  }
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
            shopTierOf(account) === "full"
              ? "Ativo, com todos os produtos liberados"
              : `Piloto (completo a partir de ${number.format(FULL_SHOP_MIN_FOLLOWERS)} seguidores, faltam ${number.format(followersToFullShop(account))})`,
        },
        { label: "Monetização", value: account.stats.monetized ? "Ativa" : "Não ativa" },
      ];
    case "instagram":
      return [
        { label: "Seguidores", value: number.format(account.followers) },
        { label: "Publicações", value: number.format(account.stats.posts) },
        { label: "Seguindo", value: number.format(account.stats.following) },
        { label: "Tipo de conta", value: account.stats.professional ? "Profissional" : "Pessoal" },
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
      const shop =
        shopTierOf(account) === "pilot"
          ? `O Shop está em modo piloto, como em toda conta com menos de ${number.format(FULL_SHOP_MIN_FOLLOWERS)} seguidores. Funciona normalmente; alguns produtos liberam conforme a conta cresce.`
          : "A conta já passou do modo piloto: todos os produtos do TikTok Shop estão disponíveis para afiliação.";
      return monetization + shop;
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

/** Texto que o site monta com os dados da conta quando o Jota não escreveu um próprio. */
export function automaticDescriptionOf(account: Account): string {
  const intro = `Conta de ${PLATFORM_LABEL[account.platform]}${account.niche ? ` de ${account.niche.toLowerCase()}` : ""} com ${number.format(account.followers)} ${audienceLabel(account).toLowerCase()}. Depois da compra você troca nome, @ e foto e começa a publicar.`;
  return `${intro}\n\n${platformParagraph(account)}`;
}

/** "Sobre esta conta" em parágrafos: o texto escrito no painel ou o automático. Linha em branco separa parágrafos. */
export function descriptionOf(account: Account): string[] {
  return (account.description ?? automaticDescriptionOf(account))
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/** Itens que dependem dos dados da conta (monetização, conta profissional, página ou perfil): entram sozinhos. */
function automaticIncluded(account: Account): string[] {
  switch (account.platform) {
    case "tiktok":
      return account.stats.monetized ? ["Monetização ativa"] : [];
    case "instagram":
      return [
        ...(account.stats.professional ? ["Conta profissional com estatísticas"] : []),
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

/** "O que está incluso": os itens automáticos da conta e depois os da rede, editados na aba Site. */
export function includedOf(account: Account, fixedByPlatform: Record<Account["platform"], string[]>): string[] {
  return [...automaticIncluded(account), ...fixedByPlatform[account.platform]];
}
