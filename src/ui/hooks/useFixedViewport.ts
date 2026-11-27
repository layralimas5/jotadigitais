import { useEffect } from "react";

const FIXED_VIEWPORT = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover";

/**
 * Pedido da Lay: o painel instalado no celular fica sempre na escala padrão, sem pinça nem o zoom
 * que o iPhone dá ao tocar num campo. Vale só enquanto a tela está aberta; o site da loja segue com zoom livre.
 */
export function useFixedViewport(): void {
  useEffect(() => {
    const meta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
    if (!meta) return;
    const original = meta.content;
    meta.content = FIXED_VIEWPORT;
    return () => {
      meta.content = original;
    };
  }, []);
}
