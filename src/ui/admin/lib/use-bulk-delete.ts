import { useState } from "react";
import type { AdminDeps, BulkDeleteResult } from "@/application/admin-use-cases";
import { useAdminView } from "../admin-view";
import { useToast } from "../toast";

/** Como a lista chama o que ela guarda, para os avisos ("3 contas apagadas", "Cliente apagado"). */
export interface Noun {
  one: string;
  many: string;
  feminine: boolean;
}

export const countOf = (count: number, noun: Noun) => `${count} ${count === 1 ? noun.one : noun.many}`;

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

function removedMessage(count: number, noun: Noun): string {
  const ending = noun.feminine ? "a" : "o";
  return count === 1 ? `${capitalize(noun.one)} apagad${ending}.` : `${countOf(count, noun)} apagad${ending}s.`;
}

interface BulkDeleteOptions<T> {
  noun: Noun;
  remove: (deps: AdminDeps, items: readonly T[]) => Promise<BulkDeleteResult>;
  /** Depois de apagar: limpar a seleção e recarregar a lista. */
  onDone: () => void;
}

/** Lixeira de uma lista: guarda quem vai ser apagado, pede confirmação, apaga e avisa o resultado. */
export function useBulkDelete<T>({ noun, remove, onDone }: BulkDeleteOptions<T>) {
  const { deps } = useAdminView();
  const toast = useToast();
  const [pending, setPending] = useState<readonly T[]>([]);
  const [busy, setBusy] = useState(false);

  const ask = (items: readonly T[]) => {
    if (items.length > 0) setPending(items);
  };

  const cancel = () => {
    if (!busy) setPending([]);
  };

  const confirm = async () => {
    setBusy(true);
    try {
      const result = await remove(deps, pending);
      if (result.failed > 0) toast.show(`${removedMessage(result.removed, noun)} ${result.failed} não saiu, tente de novo.`, "error");
      else toast.show(removedMessage(result.removed, noun));
      onDone();
    } catch (reason) {
      console.error(reason);
      toast.show(reason instanceof Error ? reason.message : "Não foi possível apagar. Tente de novo.", "error");
    } finally {
      setBusy(false);
      setPending([]);
    }
  };

  return { pending, open: pending.length > 0, busy, ask, cancel, confirm };
}
