import { shopTierOf, type Account } from "./account";
import { formatBRL } from "./money";
import { PLATFORM_LABEL } from "./platform";
import type { TemplateValues } from "./message-template";

const number = new Intl.NumberFormat("pt-BR");

const yesNo = (value: boolean, yes: string, no: string) => (value ? yes : no);

/** Uma linha por número, no formato que fica legível no WhatsApp. */
export function offerDetailsOf(account: Account): string[] {
  const niche = account.niche ? [`• Nicho: ${account.niche}`] : [];
  switch (account.platform) {
    case "tiktok":
      return [
        `• ${number.format(account.followers)} seguidores`,
        `• ${number.format(account.stats.likes)} curtidas`,
        `• TikTok Shop: ${shopTierOf(account) === "full" ? "completo" : "piloto"}`,
        `• Monetização: ${yesNo(account.stats.monetized, "ativa", "não ativa")}`,
        ...niche,
      ];
    case "instagram":
      return [
        `• ${number.format(account.followers)} seguidores`,
        `• ${number.format(account.stats.posts)} publicações`,
        `• Conta ${yesNo(account.stats.professional, "profissional", "pessoal")}`,
        `• Monetização: ${yesNo(account.stats.monetized, "ativa", "não ativa")}`,
        ...niche,
      ];
    case "youtube":
      return [
        `• ${number.format(account.followers)} inscritos`,
        `• ${number.format(account.stats.views)} visualizações`,
        `• ${number.format(account.stats.videos)} vídeos`,
        `• ${number.format(account.stats.watchHours)} horas de exibição`,
        `• Monetização: ${yesNo(account.stats.monetized, "ativa (Programa de Parcerias)", "não ativa")}`,
        ...niche,
      ];
    case "facebook":
      return [
        `• ${number.format(account.followers)} seguidores`,
        `• ${number.format(account.stats.likes)} curtidas`,
        `• ${account.stats.kind === "page" ? "Página" : "Perfil"}`,
        `• Monetização: ${yesNo(account.stats.monetized, "ativa", "não ativa")}`,
        ...niche,
      ];
  }
}

/** Valores para o modelo "Oferecer conta". `link` é a página da conta no site, onde a pessoa compra. */
export function offerValuesOf(account: Account, options: { recipientName: string; siteUrl: string; storeName: string }): TemplateValues {
  return {
    nome: options.recipientName,
    conta: `${account.displayName} (${account.handle})`,
    rede: PLATFORM_LABEL[account.platform],
    detalhes: offerDetailsOf(account).join("\n"),
    valor: formatBRL(account.price),
    link: `${options.siteUrl.replace(/\/$/, "")}/contas/${account.slug}`,
    loja: options.storeName,
  };
}
