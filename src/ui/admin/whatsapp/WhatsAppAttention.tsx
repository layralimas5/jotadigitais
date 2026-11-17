import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { listWhatsAppContacts } from "@/application/admin-use-cases";
import { needsStaff, type WhatsAppContact } from "@/domain/whatsapp";
import { useAdminQuery, usePolling } from "../hooks";
import { usePushReceived } from "../pwa/usePanelApp";

const REFRESH_MS = 20_000;

const WhatsAppAttentionContext = createContext(0);

const NO_CONTACTS = async (): Promise<WhatsAppContact[]> => [];

/** Quantas conversas esperam o Jota (a IA passou ou ele assumiu e o cliente respondeu). Uma consulta para o menu todo. */
export function WhatsAppAttentionProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  // Quem não vê o WhatsApp (a desenvolvedora, ajudante sem Automação) não consulta nada.
  const contacts = useAdminQuery(enabled ? listWhatsAppContacts : NO_CONTACTS, enabled ? "whatsapp-attention" : "whatsapp-attention-off");
  const reload = contacts.reload;
  const reloadVisible = useCallback(() => {
    if (enabled && document.visibilityState === "visible") reload();
  }, [enabled, reload]);
  usePolling(reloadVisible, REFRESH_MS);
  usePushReceived(reloadVisible);
  const data = contacts.status === "success" ? contacts.data : null;
  const count = useMemo(() => (data ? data.filter(needsStaff).length : 0), [data]);
  return <WhatsAppAttentionContext.Provider value={count}>{children}</WhatsAppAttentionContext.Provider>;
}

export const useWhatsAppAttention = (): number => useContext(WhatsAppAttentionContext);

export const whatsAppAttentionLabel = (count: number) =>
  `${count} ${count === 1 ? "conversa esperando" : "conversas esperando"} você no WhatsApp`;
