import type { Partner } from "./partner";

/** "Quem indicou" digitado no checkout ou no cadastro manual: mesmo limite da coluna no banco. */
export const REFERRED_BY_MAX_LENGTH = 80;

/** Sem acento, sem @, minúsculo e com um espaço só entre as palavras: "  Gímena  Souza" vira "gimena souza". */
export function normalizeReferralName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

const firstWordOf = (normalized: string) => normalized.split(" ")[0] ?? "";

/**
 * Parceiro que o cliente citou como quem indicou. Vale o nome completo, o @ do Instagram
 * ou só o primeiro nome, desde que nenhum outro parceiro tenha o mesmo primeiro nome.
 */
export function matchReferralPartner(referredBy: string | null, partners: readonly Partner[]): Partner | null {
  if (!referredBy) return null;
  const typed = normalizeReferralName(referredBy);
  if (!typed) return null;

  const byFullName = partners.find((partner) => normalizeReferralName(partner.name) === typed);
  if (byFullName) return byFullName;

  const byInstagram = partners.find((partner) => partner.instagram && normalizeReferralName(partner.instagram) === typed);
  if (byInstagram) return byInstagram;

  const typedFirst = firstWordOf(typed);
  const sameFirstName = partners.filter((partner) => firstWordOf(normalizeReferralName(partner.name)) === typedFirst);
  return sameFirstName.length === 1 ? (sameFirstName[0] ?? null) : null;
}
