import { useCallback, useMemo, useState } from "react";

/**
 * Seleção de várias linhas de uma lista. Só conta o que está visível: ao filtrar,
 * quem saiu da tela deixa de estar marcado (e não é apagado por engano).
 */
export function useSelection(visibleIds: readonly string[]) {
  const [marked, setMarked] = useState<ReadonlySet<string>>(() => new Set());

  const selectedIds = useMemo(() => visibleIds.filter((id) => marked.has(id)), [visibleIds, marked]);
  const selected = useMemo(() => new Set(selectedIds), [selectedIds]);
  const allSelected = visibleIds.length > 0 && selectedIds.length === visibleIds.length;

  const toggle = useCallback((id: string) => {
    setMarked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setMarked(allSelected ? new Set() : new Set(visibleIds));
  }, [allSelected, visibleIds]);

  const clear = useCallback(() => setMarked(new Set()), []);

  return { selected, selectedIds, allSelected, toggle, toggleAll, clear };
}

export type Selection = ReturnType<typeof useSelection>;
