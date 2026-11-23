/** Estado de navegação que a ficha manda para a lista depois de cadastrar uma conta nova à venda. */
export const ANNOUNCE_STATE_KEY = "announceAccountId";

/** Id da conta recém-cadastrada que deve abrir o anúncio da comunidade, se veio no estado da navegação. */
export function announcedAccountIdOf(state: unknown): string | null {
  if (typeof state !== "object" || state === null) return null;
  const value = (state as Record<string, unknown>)[ANNOUNCE_STATE_KEY];
  return typeof value === "string" ? value : null;
}
