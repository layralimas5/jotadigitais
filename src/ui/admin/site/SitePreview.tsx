import { useEffect, useRef, useState } from "react";
import type { SiteContent } from "@/domain/site-content";
import { isPreviewMessage, previewUrl, sendToPreview } from "@/ui/lib/site-preview";

export type PreviewDevice = "desktop" | "mobile";

/** Largura em que o site é desenhado antes de caber no painel: a prévia mostra o layout real de cada tela. */
const DEVICE_WIDTH: Record<PreviewDevice, number> = { desktop: 1280, mobile: 390 };
const SEND_DELAY_MS = 120;

interface SitePreviewProps {
  content: SiteContent;
  /** Página que a prévia deve mostrar. */
  path: string;
  /** Id de um elemento da página; a prévia rola até a seção dele. */
  scrollTarget: string | null;
  device: PreviewDevice;
  /** Campo focado no editor; a prévia destaca o elemento dele. */
  highlightPath: string | null;
  /** Clicaram num elemento da prévia: abrir o campo desse caminho. */
  onEdit: (path: string) => void;
}

function useBoxSize(ref: React.RefObject<HTMLElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

/** O site de verdade, aberto num iframe com ?preview, recebendo o rascunho a cada alteração. */
export function SitePreview({ content, path, scrollTarget, device, highlightPath, onEdit }: SitePreviewProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const box = useBoxSize(boxRef);
  const [framePath, setFramePath] = useState<string | null>(null);
  const [initialSrc] = useState(() => previewUrl(path));
  const latest = useRef({ content, onEdit });
  latest.current = { content, onEdit };

  // A cada página carregada no iframe, manda o rascunho e a seção aberta.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!isPreviewMessage(event) || event.source !== frameRef.current?.contentWindow) return;
      if (event.data.type === "edit") {
        latest.current.onEdit(event.data.path);
        return;
      }
      setFramePath(event.data.path);
      sendToPreview(frameRef.current, { type: "content", content: latest.current.content });
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    if (!framePath) return;
    const timer = window.setTimeout(() => sendToPreview(frameRef.current, { type: "content", content }), SEND_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [content, framePath]);

  useEffect(() => {
    if (framePath && framePath !== path) sendToPreview(frameRef.current, { type: "navigate", path });
  }, [path, framePath]);

  useEffect(() => {
    if (framePath !== path || !scrollTarget) return;
    // Dá tempo de o texto novo desenhar antes de rolar.
    const timer = window.setTimeout(() => sendToPreview(frameRef.current, { type: "scroll", target: scrollTarget }), SEND_DELAY_MS * 2);
    return () => window.clearTimeout(timer);
  }, [scrollTarget, framePath, path]);

  useEffect(() => {
    if (framePath) sendToPreview(frameRef.current, { type: "highlight", path: highlightPath });
  }, [highlightPath, framePath]);

  const width = DEVICE_WIDTH[device];
  const scale = box.width > 0 ? Math.min(1, box.width / width) : 1;
  const frameWidth = device === "mobile" ? width : Math.max(width, box.width / scale);

  return (
    <div ref={boxRef} className="relative size-full overflow-hidden">
      <div
        className="absolute top-0 left-1/2 overflow-hidden rounded-xl"
        style={{ width: frameWidth * scale, height: box.height, transform: "translateX(-50%)" }}
      >
        <iframe
          ref={frameRef}
          src={initialSrc}
          title="Prévia do site com as alterações"
          className="origin-top-left border-0 bg-ink"
          style={{ width: frameWidth, height: box.height / scale, transform: `scale(${scale})` }}
        />
      </div>
      {!framePath && (
        <div className="absolute inset-0 grid place-items-center" role="status" aria-label="Carregando a prévia">
          <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-electric" />
        </div>
      )}
    </div>
  );
}
