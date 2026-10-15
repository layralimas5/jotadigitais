import { useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import type { DragControls } from "framer-motion";
import type { LeadStage } from "@/domain/lead";

const DROP_ATTRIBUTE = "data-stage-drop";
const LONG_PRESS_MS = 320;
const MOVE_TOLERANCE_PX = 10;

/** Atributo que marca uma coluna como lugar de soltar card. */
export const dropZoneProps = (stage: LeadStage) => ({ [DROP_ATTRIBUTE]: stage });

/**
 * Coluna embaixo do ponteiro. `x`/`y` vêm do framer em coordenadas da página.
 * O card arrastado fica por cima de tudo e ainda mora na coluna de origem, então ele é ignorado.
 */
export function stageAtPoint(x: number, y: number, dragged: Element | null): LeadStage | null {
  for (const element of document.elementsFromPoint(x - window.scrollX, y - window.scrollY)) {
    if (dragged?.contains(element)) continue;
    const zone = element.closest(`[${DROP_ATTRIBUTE}]`);
    if (zone) return zone.getAttribute(DROP_ATTRIBUTE) as LeadStage;
  }
  return null;
}

/**
 * Começa o arraste: com mouse, na hora; no toque, depois de segurar o dedo parado por um instante
 * (assim o dedo ainda rola a tela normalmente). A partir do momento em que o "segurar" é reconhecido,
 * o toque deixa de rolar a página; senão o navegador assume o gesto como rolagem e cancela o arraste.
 */
export function useHoldToDrag(controls: DragControls, elementRef: RefObject<HTMLElement | null>, disabled: boolean) {
  const timer = useRef<number | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const scrollLocked = useRef(false);
  const draggedRecently = useRef(false);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;
    const blockScroll = (event: TouchEvent) => scrollLocked.current && event.preventDefault();
    element.addEventListener("touchmove", blockScroll, { passive: false });
    return () => element.removeEventListener("touchmove", blockScroll);
  }, [elementRef]);

  const cancelHold = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    origin.current = null;
  };

  const releaseTouch = () => {
    cancelHold();
    scrollLocked.current = false;
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return;
    if (event.pointerType === "mouse") {
      controls.start(event);
      return;
    }
    const nativeEvent = event.nativeEvent;
    origin.current = { x: event.clientX, y: event.clientY };
    timer.current = window.setTimeout(() => {
      timer.current = null;
      scrollLocked.current = true;
      navigator.vibrate?.(12);
      controls.start(nativeEvent);
    }, LONG_PRESS_MS);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!origin.current) return;
    const moved = Math.hypot(event.clientX - origin.current.x, event.clientY - origin.current.y);
    if (moved > MOVE_TOLERANCE_PX) cancelHold();
  };

  return {
    handlers: { onPointerDown, onPointerMove, onPointerUp: releaseTouch, onPointerCancel: releaseTouch },
    onDragStart: () => {
      draggedRecently.current = true;
    },
    onDragEnd: () => {
      scrollLocked.current = false;
      // O clique que encerra o arraste não deve abrir o card.
      window.setTimeout(() => (draggedRecently.current = false), 0);
    },
    shouldIgnoreClick: () => draggedRecently.current,
  };
}
