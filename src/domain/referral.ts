import type { Partner } from "./partner";

/** "Quem indicou" digitado no checkout ou no cadastro manual: mesmo limite da coluna no banco. */
export const REFERRED_BY_MAX_LENGTH = 80;

/** Cada compra paga de um cliente indicado rende isso ao parceiro que indicou. */
export const POINTS_PER_REFERRED_PURCHASE = 1;

/** Sem acento, sem @, minúsculo e com um espaço só entre as palavras: "  Gímena  Souza" vira "gimena souza". */
export function normalizeReferralName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/@/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._ ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Palavras que o cliente escreve em volta do nome ("vim pela gi", "indicação da Gimena") e não identificam ninguém. */
const FILLER_WORDS = new Set([
  "a", "o", "as", "os", "e", "de", "da", "do", "das", "dos", "na", "no", "pela", "pelo", "por", "com", "via", "atraves",
  "vim", "veio", "vi", "foi", "fui", "conheci", "soube", "quem", "me", "minha", "meu", "amiga", "amigo",
  "indicacao", "indicado", "indicada", "indicou", "indicaram", "insta", "instagram",
]);

/** Só as palavras que podem ser nome ou apelido: "vim pela gi" vira "gi". */
function meaningfulPart(normalized: string): string {
  return normalized
    .split(" ")
    .filter((word) => word && !FILLER_WORDS.has(word))
    .join(" ");
}

const firstWordOf = (normalized: string) => normalized.split(" ")[0] ?? "";

/** Como o cliente pode chamar o parceiro: nome completo, @, apelidos e, se ninguém mais tiver, o primeiro nome. */
function referralKeysOf(partner: Partner, partners: readonly Partner[]): string[] {
  const fullName = normalizeReferralName(partner.name);
  const firstName = firstWordOf(fullName);
  const firstNameIsUnique = partners.filter((other) => firstWordOf(normalizeReferralName(other.name)) === firstName).length === 1;
  return [
    fullName,
    partner.instagram ? normalizeReferralName(partner.instagram) : "",
    firstNameIsUnique ? firstName : "",
    ...(partner.tags ?? []).map(normalizeReferralName),
  ].filter(Boolean);
}

/** O texto é a chave inteira ou tem a chave como palavra(s) solta(s): "gi" aparece em "vim pela gi", não em "giovana". */
const mentions = (text: string, key: string) => text === key || ` ${text} `.includes(` ${key} `);

/**
 * Parceiro que o cliente citou como quem indicou. Reconhece o nome completo, o @, os apelidos cadastrados
 * no parceiro e o primeiro nome (quando só um parceiro tem esse nome), mesmo no meio de uma frase.
 * Se o texto servir para mais de um parceiro, ninguém leva: melhor o Jota conferir do que dar ponto à pessoa errada.
 */
export function matchReferralPartner(referredBy: string | null, partners: readonly Partner[]): Partner | null {
  if (!referredBy) return null;
  const typed = normalizeReferralName(referredBy);
  if (!typed) return null;
  const meaningful = meaningfulPart(typed);

  const byFullName = partners.filter((partner) => normalizeReferralName(partner.name) === typed || normalizeReferralName(partner.name) === meaningful);
  if (byFullName.length === 1) return byFullName[0] ?? null;

  const mentioned = partners.filter((partner) =>
    referralKeysOf(partner, partners).some((key) => mentions(typed, key) || (meaningful !== "" && mentions(meaningful, key))),
  );
  return mentioned.length === 1 ? (mentioned[0] ?? null) : null;
}
