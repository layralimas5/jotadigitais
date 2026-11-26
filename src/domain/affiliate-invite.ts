import { affiliateText, type AffiliateProgramTexts, type CommissionRule } from "./affiliate";

/**
 * Convite de afiliado (entrega 3): o Jota cria com a comissão combinada, a pessoa abre o link, aceita os termos,
 * valida o CPF e já entra aprovada. Mesmas regras de `affiliate_invites` no banco.
 */

export const AFFILIATE_INVITE_STATUSES = ["pending", "claimed", "revoked"] as const;
export type AffiliateInviteStatus = (typeof AFFILIATE_INVITE_STATUSES)[number];

export const AFFILIATE_INVITE_STATUS_LABEL: Record<AffiliateInviteStatus, string> = {
  pending: "Convite enviado",
  claimed: "Aceito",
  revoked: "Cancelado",
};

export interface AffiliateInviteData {
  name: string;
  whatsapp: string | null;
  email: string | null;
  /** Comissão própria combinada. Nula = a padrão do programa. */
  commission: CommissionRule | null;
  note: string | null;
}

export interface AffiliateInvite extends AffiliateInviteData {
  id: string;
  token: string;
  status: AffiliateInviteStatus;
  claimedAffiliateId: string | null;
  createdAt: string;
}

/** O que a página "Seja afiliado" recebe do convite para preencher o formulário. */
export interface AffiliateInvitePreview {
  name: string;
  whatsapp: string | null;
  email: string | null;
}

export const INVITE_PARAM = "convite";
export const INVITE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{20,64}$/;

/** Código do convite que veio no link. Nulo se não tiver o formato. */
export function parseInviteToken(raw: string | null): string | null {
  const token = (raw ?? "").trim();
  return INVITE_TOKEN_PATTERN.test(token) ? token : null;
}

export const affiliateInviteLink = (origin: string, token: string) =>
  `${origin.replace(/\/$/, "")}/seja-afiliado?${INVITE_PARAM}=${encodeURIComponent(token)}`;

/** Mensagem pronta do WhatsApp (o Jota edita o texto em Programa > Textos). */
export const affiliateInviteMessage = (texts: AffiliateProgramTexts, invite: Pick<AffiliateInvite, "name" | "token">, origin: string) =>
  affiliateText(texts, "inviteMessage", { nome: invite.name.split(" ")[0] ?? invite.name, link: affiliateInviteLink(origin, invite.token) });

/** wa.me com a mensagem. Sem WhatsApp no convite, abre o WhatsApp para o Jota escolher o contato. */
export function affiliateInviteWhatsAppUrl(whatsapp: string | null, message: string): string {
  const digits = (whatsapp ?? "").replace(/\D/g, "");
  const phone = digits.length >= 10 && digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
