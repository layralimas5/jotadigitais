import { useEffect, type RefObject } from "react";

/** Fecha um menu ou painel quando a pessoa toca fora dele. */
export function useCloseOnOutsideClick(open: boolean, close: () => void, root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open, close, root]);
}
