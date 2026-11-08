/** Quando foi a última recarga por versão nova: evita ficar recarregando em volta se o problema for outro. */
const RELOAD_KEY = "jd:reloaded-for-new-version";
const MIN_INTERVAL_MS = 15_000;

/** Depois de um deploy, a aba aberta ainda pede os arquivos da versão antiga, que não existem mais. */
export function isOutdatedBuildError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);
}

/** Recarrega a página para pegar a versão nova. Devolve falso se já recarregou há pouco (aí mostra o erro). */
export function reloadForNewVersion(): boolean {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) ?? 0);
    if (Date.now() - last < MIN_INTERVAL_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Sem sessionStorage (navegação privada restrita): recarrega mesmo assim, uma vez por erro.
  }
  window.location.reload();
  return true;
}
