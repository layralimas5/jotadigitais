import { useCallback, useEffect, useState } from "react";

/** Chave do painel da loja; o painel do afiliado guarda a escolha em outra. */
export const ADMIN_SIDEBAR_KEY = "jota:sidebar-collapsed";
const EXPANDED_WIDTH = "15rem";
const COLLAPSED_WIDTH = "4.5rem";

function readStored(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function store(key: string, collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(key, "1");
    else window.localStorage.removeItem(key);
  } catch (error) {
    console.warn("Não foi possível lembrar o menu encolhido neste navegador", error);
  }
}

/**
 * Menu lateral encolhido (só ícones) ou aberto. A escolha fica neste navegador e a largura vira a variável
 * `--sidebar-w` no <html>, que o conteúdo e as barras fixas usam para acompanhar. Com `focus` (quadro de fluxos), encolhe.
 */
export function useSidebarCollapsed(focus = false, storageKey: string = ADMIN_SIDEBAR_KEY) {
  const [stored, setStored] = useState(() => readStored(storageKey));
  // No modo foco o menu começa encolhido; abrir ali vale só até sair da tela, sem mudar a preferência.
  const [focusOverride, setFocusOverride] = useState<boolean | null>(null);
  useEffect(() => setFocusOverride(null), [focus]);
  const collapsed = focus ? (focusOverride ?? true) : stored;

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--sidebar-w", collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH);
    return () => {
      root.style.removeProperty("--sidebar-w");
    };
  }, [collapsed]);

  const toggle = useCallback(() => {
    if (focus) {
      setFocusOverride(!collapsed);
      return;
    }
    setStored((current) => {
      store(storageKey, !current);
      return !current;
    });
  }, [focus, collapsed, storageKey]);

  return { collapsed, toggle };
}
