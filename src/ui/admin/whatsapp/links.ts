/** Endereços que ligam a aba WhatsApp (conversas) e a aba Automação (configuração da IA). */
import { WHATSAPP_PATH } from "../navigation";

export { WHATSAPP_PATH };
export const AUTOMATION_PATH = "/admin/automacao";

/** Parâmetros que a aba Automação > IA lê para já abrir com uma pergunta nova preenchida. */
export const TEACH_QUESTION_PARAM = "pergunta";
export const TEACH_ANSWER_PARAM = "resposta";

export const conversationLink = (contactId: string) => `${WHATSAPP_PATH}?c=${encodeURIComponent(contactId)}`;

export const aiSettingsLink = () => `${AUTOMATION_PATH}?aba=ia`;

/** "Ensinar essa resposta": a resposta que o Jota deu vira pergunta frequente da IA. */
export function teachLink(question: string, answer: string): string {
  const params = new URLSearchParams({ aba: "ia", [TEACH_QUESTION_PARAM]: question.slice(0, 300), [TEACH_ANSWER_PARAM]: answer.slice(0, 2000) });
  return `${AUTOMATION_PATH}?${params.toString()}`;
}
