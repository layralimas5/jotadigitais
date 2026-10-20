import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { container } from "@/app/container";
import { getSiteContent } from "@/application/use-cases";
import { FULL_SHOP_MIN_FOLLOWERS } from "@/domain/account";
import { DEFAULT_SITE_CONTENT, fillTokens, mergeWithDefaults, type SiteContent } from "@/domain/site-content";
import { highlightEditable, installEditLayer, scrollWithinPage } from "@/ui/lib/preview-edit-layer";
import { IS_SITE_PREVIEW, isEditorMessage, sendToEditor } from "@/ui/lib/site-preview";
import { useStoreSettings } from "./useStoreSettings";

const SiteContentContext = createContext<SiteContent>(DEFAULT_SITE_CONTENT);

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

/** Textos do site salvos no painel. Até chegarem (ou se falharem), vale o texto original. */
export function SiteContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<SiteContent>(DEFAULT_SITE_CONTENT);
  const [draft, setDraft] = useState<SiteContent | null>(null);
  const onDraft = useCallback((next: SiteContent) => setDraft(next), []);
  usePreviewDraft(onDraft);

  useEffect(() => {
    let active = true;
    getSiteContent(container.store).then(
      (loaded) => active && setContent(loaded),
      (error: unknown) => console.error("Falha ao carregar os textos do site", error),
    );
    return () => {
      active = false;
    };
  }, []);

  return <SiteContentContext.Provider value={draft ?? content}>{children}</SiteContentContext.Provider>;
}

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
