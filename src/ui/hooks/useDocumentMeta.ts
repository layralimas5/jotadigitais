import { useEffect } from "react";

const SITE = "Jota Digitais";

/** `homeTitle` é o título inteiro da página inicial, editável no painel. */
export function useDocumentMeta(title: string, description?: string, homeTitle?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : (homeTitle ?? `${SITE} | Contas de TikTok com TikTok Shop liberado`);
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    }
  }, [title, description, homeTitle]);
}
