import { useEffect } from "react";

const SITE = "Jota Digitais";

export function useDocumentMeta(title: string, description?: string) {
  useEffect(() => {
    document.title = title ? `${title} | ${SITE}` : `${SITE} | Contas de TikTok com TikTok Shop liberado`;
    if (description) {
      document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    }
  }, [title, description]);
}
