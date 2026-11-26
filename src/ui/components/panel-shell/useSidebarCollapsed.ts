import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "jota:sidebar-collapsed";
const EXPANDED_WIDTH = "15rem";
const COLLAPSED_WIDTH = "4.5rem";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function store(collapsed: boolean): void {
  try {
    if (collapsed) window.localStorage.setItem(STORAGE_KEY, "1");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Não foi possível lembrar o menu encolhido neste navegador", error);
  }
}

/**
 * Menu lateral encolhido (só ícones) ou aberto. A escolha fica neste navegador e a largura vira a variável
 * `--sidebar-w` no <html>, que o conteúdo e as barras fixas usam para acompanhar. Com `focus` (quadro de fluxos), encolhe.
 */
export function useSidebarCollapsed(focus = false) {
  const [stored, setStored] = useState(readStored);
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
      store(!current);
      return !current;
    });
  }, [focus, collapsed]);

  return { collapsed, toggle };
}
