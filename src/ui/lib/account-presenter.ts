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

export interface Spec {
  label: string;
  value: string;
}

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
      return shopTierOf(account) === "full"
        ? { label: "TikTok Shop ativo", tone: "electric" }
        : { label: "Shop piloto", tone: "pink" };
    case "instagram":
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
        { label: "Central de Criadores", value: "Ativa" },
        { label: "Origem dos seguidores", value: "Brasil" },
        { label: "Documentos vinculados", value: "Nenhum" },
      ];
    case "instagram":
      return [
        { label: "Seguidores", value: number.format(account.followers) },
        { label: "Publicações", value: number.format(account.stats.posts) },
        { label: "Seguindo", value: number.format(account.stats.following) },
        { label: "Tipo de conta", value: account.stats.professional ? "Profissional" : "Pessoal" },
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

export function specsOf(account: Account): Spec[] {
  return [
    { label: "Rede", value: PLATFORM_LABEL[account.platform] },
    ...(account.niche ? [{ label: "Nicho atual", value: account.niche }] : []),
    ...platformSpecs(account),
    { label: "Troca de nome, @ e foto", value: "Liberada" },
    { label: "Anunciada em", value: date.format(new Date(account.listedAt)) },
  ];
}

function platformParagraph(account: Account): string {
  switch (account.platform) {
    case "tiktok":
      return shopTierOf(account) === "pilot"
        ? `O Shop está em modo piloto, como em toda conta com menos de ${number.format(FULL_SHOP_MIN_FOLLOWERS)} seguidores. Funciona normalmente; alguns produtos liberam conforme a conta cresce.`
        : "A conta já passou do modo piloto: todos os produtos do TikTok Shop estão disponíveis para afiliação.";
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

export function descriptionOf(account: Account): string[] {
  const intro =
    account.description ??
    `Conta de ${PLATFORM_LABEL[account.platform]}${account.niche ? ` de ${account.niche.toLowerCase()}` : ""} com ${number.format(account.followers)} ${audienceLabel(account).toLowerCase()}. Depois da compra você troca nome, @ e foto e começa a publicar.`;
  return [intro, platformParagraph(account)];
}

export function includedOf(account: Account): string[] {
  const common = ["Troca livre de nome, @ e foto", "Login e senha entregues por e-mail"];
  switch (account.platform) {
    case "tiktok":
      return [
        "Central de Criadores do TikTok Shop ativa",
        "Seguidores reais e brasileiros",
        "Sem documentos vinculados",
        ...common,
      ];
    case "instagram":
      return [...(account.stats.professional ? ["Conta profissional com estatísticas"] : []), ...common, "E-mail da conta trocado para o seu"];
    case "youtube":
      return [
        "Acesso de proprietário ao canal",
        ...(account.stats.monetized ? ["Programa de Parcerias ativo"] : []),
        ...common,
      ];
    case "facebook":
      return [
        account.stats.kind === "page" ? "Acesso de administrador total à página" : "Acesso completo ao perfil",
        ...(account.stats.monetized ? ["Monetização ativa"] : []),
        ...common,
      ];
  }
}

export function guaranteeText(account: Pick<Account, "platform">): string {
  return account.platform === "tiktok"
    ? "Shop inativo na entrega? Você recebe outra conta ou o dinheiro de volta."
    : "Conta diferente do anunciado na entrega? Você recebe outra ou o dinheiro de volta.";
}
