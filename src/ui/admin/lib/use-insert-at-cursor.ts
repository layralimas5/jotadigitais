import { useCallback, useRef } from "react";

/** Põe um trecho onde está o cursor do campo de texto, sem apagar o que foi escrito, e devolve o foco a ele. */
export function useInsertAtCursor(value: string, onChange: (value: string) => void) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const insert = useCallback(
    (token: string) => {
      const field = ref.current;
      if (!field) return onChange(`${value}${token}`);
      const start = field.selectionStart ?? value.length;
      const end = field.selectionEnd ?? value.length;
      onChange(`${value.slice(0, start)}${token}${value.slice(end)}`);
      requestAnimationFrame(() => {
        field.focus();
        field.setSelectionRange(start + token.length, start + token.length);
      });
    },
    [value, onChange],
  );
  return { ref, insert };
}
