import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";
import { listWhatsAppContacts } from "@/application/admin-use-cases";
import { needsStaff, samePhone, type WhatsAppContact } from "@/domain/whatsapp";
import { useAdminQuery, usePolling } from "../hooks";
import { usePushReceived } from "../pwa/usePanelApp";

const REFRESH_MS = 20_000;

const WhatsAppAttentionContext = createContext(0);

/** Acha a conversa do painel pelo número (com ou sem 55 e nono dígito). Nulo sem conversa ou sem acesso ao WhatsApp. */
type ConversationLookup = (phone: string) => string | null;

const ConversationLookupContext = createContext<ConversationLookup>(() => null);

const NO_CONTACTS = async (): Promise<WhatsAppContact[]> => [];

/**
 * Quantas conversas esperam o Jota (a IA passou ou ele assumiu e o cliente respondeu) e a conversa de cada número, para
 * "Abrir no WhatsApp" de Pedidos e Clientes. Uma consulta para o painel todo.
 */
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
  const lookup = useCallback<ConversationLookup>((phone) => data?.find((contact) => samePhone(contact.phone, phone))?.id ?? null, [data]);
  return (
    <WhatsAppAttentionContext.Provider value={count}>
      <ConversationLookupContext.Provider value={lookup}>{children}</ConversationLookupContext.Provider>
    </WhatsAppAttentionContext.Provider>
  );
}

/** Id da conversa desse número no painel, quando existe. */
export const useWhatsAppConversation = (phone: string | null): string | null => {
  const lookup = useContext(ConversationLookupContext);
  return phone ? lookup(phone) : null;
};

export const useWhatsAppAttention = (): number => useContext(WhatsAppAttentionContext);

export const whatsAppAttentionLabel = (count: number) =>
  `${count} ${count === 1 ? "conversa esperando" : "conversas esperando"} você no WhatsApp`;
