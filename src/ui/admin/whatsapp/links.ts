/** Endereços da aba WhatsApp: conversas, fluxos, IA, entrega e mensagens ficam todos em /admin/whatsapp?aba=. */
import { WHATSAPP_PATH } from "../navigation";

export { WHATSAPP_PATH };

export type WhatsAppTab = "conversas" | "fluxos" | "ia" | "entrega" | "mensagens";
export const WHATSAPP_TABS: readonly WhatsAppTab[] = ["conversas", "fluxos", "ia", "entrega", "mensagens"];
export const TAB_PARAM = "aba";

export const whatsAppTabOf = (value: string | null): WhatsAppTab => WHATSAPP_TABS.find((tab) => tab === value) ?? "conversas";

export const whatsAppTabLink = (tab: WhatsAppTab) => (tab === "conversas" ? WHATSAPP_PATH : `${WHATSAPP_PATH}?${TAB_PARAM}=${tab}`);

/** Parâmetros que a aba IA lê para já abrir com uma pergunta nova preenchida. */
export const TEACH_QUESTION_PARAM = "pergunta";
export const TEACH_ANSWER_PARAM = "resposta";

export const conversationLink = (contactId: string) => `${WHATSAPP_PATH}?c=${encodeURIComponent(contactId)}`;

export const aiSettingsLink = () => whatsAppTabLink("ia");

/** "Ensinar essa resposta": a resposta que o Jota deu vira pergunta frequente da IA. */
export function teachLink(question: string, answer: string): string {
  const params = new URLSearchParams({ [TAB_PARAM]: "ia", [TEACH_QUESTION_PARAM]: question.slice(0, 300), [TEACH_ANSWER_PARAM]: answer.slice(0, 2000) });
  return `${WHATSAPP_PATH}?${params.toString()}`;
}
