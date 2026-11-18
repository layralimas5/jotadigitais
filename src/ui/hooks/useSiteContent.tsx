import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { container } from "@/app/container";
import { getSiteContent } from "@/application/use-cases";
import { FULL_SHOP_MIN_FOLLOWERS } from "@/domain/account";
import { DEFAULT_SITE_CONTENT, fillTokens, mergeWithDefaults, type SiteContent } from "@/domain/site-content";
import { highlightEditable, installEditLayer, scrollWithinPage } from "@/ui/lib/preview-edit-layer";
import { cacheSiteContent, readCachedSiteContent } from "@/ui/lib/site-cache";
import { IS_SITE_PREVIEW, isEditorMessage, sendToEditor } from "@/ui/lib/site-preview";
import { useStoreSettings } from "./useStoreSettings";

const SiteContentContext = createContext<SiteContent>(DEFAULT_SITE_CONTENT);
/** Já dá para mostrar o site: há texto salvo (a cópia do navegador ou o que acabou de chegar do banco). */
const SiteContentReadyContext = createContext(true);

let siteContentRequest: Promise<SiteContent> | null = null;

/** Uma busca só por carregamento, guardando a cópia para a próxima visita abrir já certa. */
function loadSiteContent(): Promise<SiteContent> {
  siteContentRequest ??= getSiteContent(container.store).then((content) => {
    cacheSiteContent(content);
    return content;
  });
  return siteContentRequest;
}

/** No editor do painel, o rascunho chega por mensagem e substitui o texto salvo na hora. */
function usePreviewDraft(onDraft: (content: SiteContent) => void) {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!IS_SITE_PREVIEW) return;
    const onMessage = (event: MessageEvent) => {
      if (!isEditorMessage(event)) return;
      const message = event.data;
      if (message.type === "content") {
        // Mesma origem e só o painel manda: o rascunho pode ter campo vazio enquanto a pessoa digita, e tudo bem.
        onDraft(mergeWithDefaults(message.content) as SiteContent);
      } else if (message.type === "scroll") {
        const target = document.getElementById(message.target);
        const block = target?.closest("section, footer") ?? target;
        if (block) scrollWithinPage(block, "start");
      } else if (message.type === "highlight") {
        highlightEditable(message.path);
      } else {
        navigate(message.path);
      }
    };
    window.addEventListener("message", onMessage);
    const removeEditLayer = installEditLayer();
    return () => {
      window.removeEventListener("message", onMessage);
      removeEditLayer();
    };
  }, [navigate, onDraft]);

  useEffect(() => {
    if (IS_SITE_PREVIEW) sendToEditor({ type: "ready", path: pathname });
  }, [pathname]);
}

/**
 * Textos do site salvos no painel. Abre com a cópia do navegador (sem ela, fica "não pronto" até o banco responder);
 * se o banco falhar, vale o texto original.
 */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => {
    const cached = readCachedSiteContent();
    // A busca sai já na primeira renderização, sem esperar o efeito.
    void loadSiteContent().catch(() => undefined);
    return { content: cached ?? DEFAULT_SITE_CONTENT, ready: cached !== null };
  });
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const onDraft = useCallback((next: SiteContent) => setDraft(next), []);
  usePreviewDraft(onDraft);

  useEffect(() => {
    let active = true;
    loadSiteContent().then(
      (content) => active && setState({ content, ready: true }),
      (error: unknown) => {
        console.error("Falha ao carregar os textos do site", error);
        if (active) setState((current) => ({ ...current, ready: true }));
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return (
    <SiteContentReadyContext.Provider value={state.ready || IS_SITE_PREVIEW}>
      <SiteContentContext.Provider value={draft ?? state.content}>{children}</SiteContentContext.Provider>
    </SiteContentReadyContext.Provider>
  );
}

export const useSiteContentReady = (): boolean => useContext(SiteContentReadyContext);

export function useSiteContent(): SiteContent {
  return useContext(SiteContentContext);
}

/** Troca {dias}, {instagram} e {seguidores_shop} pelos valores atuais da loja. */
export function useFillTokens(): (text: string) => string {
  const { guaranteeDays, instagramHandle } = useStoreSettings();
  return useMemo(() => {
    const tokens = { guaranteeDays, instagramHandle, fullShopMinFollowers: FULL_SHOP_MIN_FOLLOWERS };
    return (text: string) => fillTokens(text, tokens);
  }, [guaranteeDays, instagramHandle]);
}
