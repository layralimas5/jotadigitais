import type { SiteContent } from "@/domain/site-content";

/**
 * Conversa entre o editor da aba Site (painel) e o site aberto dentro dele num iframe.
 * As duas pontas são da mesma origem; mensagem de outra origem é ignorada.
 */

const EDITOR = "jota-site-editor";
const PREVIEW = "jota-site-preview";

export const PREVIEW_PARAM = "preview";

export type EditorMessage =
  | { source: typeof EDITOR; type: "content"; content: SiteContent }
  | { source: typeof EDITOR; type: "scroll"; target: string }
  | { source: typeof EDITOR; type: "navigate"; path: string };

export type PreviewMessage = { source: typeof PREVIEW; type: "ready"; path: string };

type Payload<M> = M extends unknown ? Omit<M, "source"> : never;

const hasSource = (data: unknown, source: string): boolean =>
  typeof data === "object" && data !== null && (data as { source?: unknown }).source === source;

export function isEditorMessage(event: MessageEvent): event is MessageEvent<EditorMessage> {
  return event.origin === window.location.origin && hasSource(event.data, EDITOR);
}

export function isPreviewMessage(event: MessageEvent): event is MessageEvent<PreviewMessage> {
  return event.origin === window.location.origin && hasSource(event.data, PREVIEW);
}

export function sendToPreview(frame: HTMLIFrameElement | null, message: Payload<EditorMessage>) {
  frame?.contentWindow?.postMessage({ ...message, source: EDITOR }, window.location.origin);
}

export function sendToEditor(message: Payload<PreviewMessage>) {
  window.parent.postMessage({ ...message, source: PREVIEW }, window.location.origin);
}

/** O site está aberto dentro do editor do painel (iframe com ?preview). Calculado uma vez, ao carregar. */
export const IS_SITE_PREVIEW =
  typeof window !== "undefined" &&
  window.parent !== window &&
  new URLSearchParams(window.location.search).has(PREVIEW_PARAM);

export const previewUrl = (path: string) => `${path}${path.includes("?") ? "&" : "?"}${PREVIEW_PARAM}=1`;
