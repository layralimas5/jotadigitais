import { useCallback, useEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";

/** Distância (px) a partir da qual o gesto vira arraste e o clique do fim é ignorado. */
const DRAG_THRESHOLD = 6;

/**
 * Fileira com rolagem lateral que o mouse também arrasta (no toque o navegador já faz isso).
 * Diz se há conteúdo escondido de cada lado, para mostrar setas e esmaecer as bordas.
 */
export function useDragScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const drag = useRef<{ startX: number; startScroll: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [edges, setEdges] = useState({ start: false, end: false });
  const [dragging, setDragging] = useState(false);

  const measure = useCallback(() => {
    const element = ref.current;
    if (!element) return;
    const max = element.scrollWidth - element.clientWidth;
    setEdges({ start: element.scrollLeft > 1, end: element.scrollLeft < max - 1 });
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [measure]);

  const onPointerDown = (event: PointerEvent<T>) => {
    if (event.pointerType !== "mouse" || event.button !== 0 || !ref.current) return;
    drag.current = { startX: event.clientX, startScroll: ref.current.scrollLeft, moved: false };
  };

  const onPointerMove = (event: PointerEvent<T>) => {
    const state = drag.current;
    const element = ref.current;
    if (!state || !element) return;
    const delta = event.clientX - state.startX;
    if (!state.moved && Math.abs(delta) < DRAG_THRESHOLD) return;
    if (!state.moved) {
      state.moved = true;
      setDragging(true);
      element.setPointerCapture(event.pointerId);
    }
    element.scrollLeft = state.startScroll - delta;
  };

  const endDrag = (event: PointerEvent<T>) => {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    suppressClick.current = true;
    setDragging(false);
    if (ref.current?.hasPointerCapture(event.pointerId)) ref.current.releasePointerCapture(event.pointerId);
  };

  /** Arrastar e soltar em cima de um card não pode selecionar o card. */
  const onClickCapture = (event: MouseEvent<T>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  /** Anda quase uma tela da fileira para o lado. */
  const page = (direction: -1 | 1) => {
    const element = ref.current;
    if (!element) return;
    element.scrollBy({ left: direction * element.clientWidth * 0.8, behavior: "smooth" });
  };

  return {
    ref,
    edges,
    dragging,
    page,
    handlers: { onPointerDown, onPointerMove, onPointerUp: endDrag, onPointerCancel: endDrag, onClickCapture },
  };
}
