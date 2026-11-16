import { useSyncExternalStore } from "react";
import { container } from "@/app/container";
import { getTagColors } from "@/application/use-cases";
import type { TagColors } from "@/domain/tag-color";

// Uma cópia só para o site inteiro: os cards da vitrine leem daqui, e o painel atualiza na hora quando o Jota salva.
let colors: TagColors = {};
let requested = false;
const listeners = new Set<() => void>();

const notify = () => listeners.forEach((listener) => listener());

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!requested) {
    requested = true;
    getTagColors(container.store).then(
      (loaded) => {
        colors = { ...loaded, ...colors };
        notify();
      },
      (error: unknown) => console.error("Falha ao carregar as cores das tags", error),
    );
  }
  return () => listeners.delete(listener);
}

/** Cores das tags. Até chegarem (ou se falharem), as tags ficam com o visual padrão. */
export function useTagColors(): TagColors {
  return useSyncExternalStore(subscribe, () => colors, () => colors);
}

/** O painel chama depois de salvar: card, página da conta e a própria ficha mudam sem recarregar. */
export function publishTagColor(key: string, color: string | null) {
  const next = { ...colors };
  if (color === null) delete next[key];
  else next[key] = color;
  colors = next;
  notify();
}

/** O painel carrega pelo próprio acesso (inclusive no ambiente de teste) e substitui a cópia. */
export function replaceTagColors(loaded: TagColors) {
  colors = loaded;
  notify();
}
