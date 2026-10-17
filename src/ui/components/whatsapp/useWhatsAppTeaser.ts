import { useCallback, useEffect, useState } from "react";

const SEEN_KEY = "jota:whatsapp-teaser-seen";
const SHOW_DELAY_MS = 1800;

function wasSeen(): boolean {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    window.sessionStorage.setItem(SEEN_KEY, "1");
  } catch {
    // Sem sessionStorage (aba anônima bloqueada) o convite só volta a aparecer no próximo carregamento.
  }
}

/** O convite "Deseja falar com o Jota?" aparece uma vez por visita, pouco depois de o site abrir. */
export function useWhatsAppTeaser() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (wasSeen()) return;
    const timer = window.setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  const dismiss = useCallback(() => {
    markSeen();
    setVisible(false);
  }, []);

  return { visible, dismiss };
}
