import {
  useEffect,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

/** Arrasto menor que isso conta como clique no botão, não como arrasto da faixa. */
const DRAG_THRESHOLD_PX = 6;

interface DragState {
  pointerId: number;
  startX: number;
  startOffset: number;
  moved: boolean;
}

/**
 * Loop contínuo para a esquerda que também aceita arrasto (mouse e dedo) e rolagem lateral do trackpad.
 * A faixa tem duas metades iguais: quando o deslocamento passa de uma metade, volta ao início sem salto visível.
 * Pausa enquanto o mouse está em cima ou algum botão tem foco pelo teclado.
 */
export function useDraggableMarquee(secondsPerHalf: number) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const offset = useRef(0);
  const drag = useRef<DragState | null>(null);
  const hovered = useRef(false);
  const suppressClick = useRef(false);

  const halfWidth = () => (trackRef.current?.scrollWidth ?? 0) / 2;

  const apply = () => {
    const half = halfWidth();
    if (half > 0) offset.current = ((offset.current % half) - half) % half;
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${offset.current}px, 0, 0)`;
  };

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      const focused = viewportRef.current?.matches(":has(:focus-visible)") ?? false;
      const half = halfWidth();
      if (!drag.current && !hovered.current && !focused && half > 0) {
        offset.current -= (half / secondsPerHalf) * elapsed;
        apply();
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [secondsPerHalf]);

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, startX: event.clientX, startOffset: offset.current, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    const delta = event.clientX - state.startX;
    if (!state.moved && Math.abs(delta) < DRAG_THRESHOLD_PX) return;
    if (!state.moved) {
      state.moved = true;
      // Só captura depois de virar arrasto: capturar antes faria o clique simples não chegar no botão.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    offset.current = state.startOffset + delta;
    apply();
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const state = drag.current;
    if (!state || state.pointerId !== event.pointerId) return;
    suppressClick.current = state.moved;
    drag.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };

  /** Depois de um arrasto o navegador ainda dispara um clique: ele não pode trocar o filtro. */
  const onClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClick.current) return;
    suppressClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaX) <= Math.abs(event.deltaY)) return;
    offset.current -= event.deltaX;
    apply();
  };

  return {
    viewportRef,
    trackRef,
    viewportProps: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onClickCapture,
      onWheel,
      onPointerEnter: (event: ReactPointerEvent<HTMLDivElement>) => {
        if (event.pointerType === "mouse") hovered.current = true;
      },
      onPointerLeave: () => {
        hovered.current = false;
      },
    },
  };
}
