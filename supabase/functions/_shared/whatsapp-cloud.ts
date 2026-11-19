// Envio de texto livre pela Cloud API da Meta. Só vale dentro da janela de 24h aberta pela última mensagem do cliente.
// Segredos: WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID e, opcional, WHATSAPP_API_VERSION.

const DEFAULT_API_VERSION = "v24.0";

/** Falha que a Meta devolveu ou configuração ausente: vai para o registro da mensagem, não derruba a função. */
export class CloudSendError extends Error {}

async function postMessage(payload: Record<string, unknown>): Promise<string> {
  const token = Deno.env.get("WHATSAPP_TOKEN");
  const phoneId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  if (!token || !phoneId) throw new CloudSendError("WhatsApp não conectado: faltam WHATSAPP_TOKEN e WHATSAPP_PHONE_NUMBER_ID.");
  const version = Deno.env.get("WHATSAPP_API_VERSION") ?? DEFAULT_API_VERSION;
  const response = await fetch(`https://graph.facebook.com/${version}/${phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
  });
  const result = (await response.json().catch(() => null)) as { messages?: { id: string }[]; error?: { message?: string } } | null;
  const id = result?.messages?.[0]?.id;
  if (!response.ok || !id) {
    throw new CloudSendError(`Meta recusou (${response.status}): ${result?.error?.message ?? "sem detalhe"}`.slice(0, 1000));
  }
  return id;
}

export const sendCloudText = (to: string, body: string): Promise<string> =>
  postMessage({ to, type: "text", text: { body, preview_url: true } });

const MAX_BUTTONS = 3;
const BUTTON_TITLE = 20;
const ROW_TITLE = 24;

/** Pergunta com opções: até 3 viram botões de resposta; mais que isso, uma lista ("Ver opções"). */
export function sendCloudOptions(to: string, body: string, options: readonly string[]): Promise<string> {
  const interactive =
    options.length <= MAX_BUTTONS
      ? {
          type: "button",
          body: { text: body },
          action: { buttons: options.map((title, index) => ({ type: "reply", reply: { id: `opt${index + 1}`, title: title.slice(0, BUTTON_TITLE) } })) },
        }
      : {
          type: "list",
          body: { text: body },
          action: {
            button: "Ver opções",
            sections: [{ title: "Opções", rows: options.map((title, index) => ({ id: `opt${index + 1}`, title: title.slice(0, ROW_TITLE) })) }],
          },
        };
  return postMessage({ to, type: "interactive", interactive });
}

/** Janela de atendimento da Meta: texto livre só até 24h depois da última mensagem do cliente. */
export const WINDOW_MS = 24 * 60 * 60 * 1000;

export const insideWindow = (lastInboundAt: string | null, now = Date.now()): boolean =>
  lastInboundAt !== null && now - new Date(lastInboundAt).getTime() < WINDOW_MS;

/** Modelo aprovado na Meta: único jeito de puxar conversa fora da janela de 24h. */
export function sendCloudTemplate(
  to: string,
  template: { name: string; language: string },
  params: readonly string[],
  /** Payload do botão de resposta rápida (índice 0), quando o modelo tem um. */
  quickReplyPayload?: string,
): Promise<string> {
  const components: Record<string, unknown>[] = [{ type: "body", parameters: params.map((text) => ({ type: "text", text })) }];
  if (quickReplyPayload) {
    components.push({ type: "button", sub_type: "quick_reply", index: "0", parameters: [{ type: "payload", payload: quickReplyPayload }] });
  }
  return postMessage({ to, type: "template", template: { name: template.name, language: { code: template.language }, components } });
}
