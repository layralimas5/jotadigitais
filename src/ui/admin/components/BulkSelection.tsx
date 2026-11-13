import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Minus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/ui/lib/cn";
import type { Selection } from "../lib/use-selection";
import { countOf, type Noun } from "../lib/use-bulk-delete";
import { ConfirmDialog } from "./ConfirmDialog";

interface SelectCheckboxProps {
  checked: boolean;
  /** Parte da lista marcada: mostra um traço no lugar do visto. */
  mixed?: boolean;
  label: string;
  onChange: () => void;
  className?: string;
}

/** Caixinha de marcar acima do link que cobre a linha, com área de toque de 36px. */
export function SelectCheckbox({ checked, mixed = false, label, onChange, className }: SelectCheckboxProps) {
  const Icon = mixed ? Minus : Check;
  return (
    <label className={cn("relative z-10 grid size-9 shrink-0 cursor-pointer place-items-center", className)}>
      <input
        type="checkbox"
        checked={checked}
        aria-checked={mixed ? "mixed" : checked}
        onChange={onChange}
        aria-label={label}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={cn(
          "grid size-5 place-items-center rounded-md border transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-electric peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-ink",
          checked || mixed ? "border-electric bg-electric text-ink" : "border-line-strong bg-ink/40 hover:border-mist",
        )}
      >
        {(checked || mixed) && <Icon className="size-3.5" strokeWidth={3} />}
      </span>
    </label>
  );
}

/** Caixinha do topo: marca ou desmarca tudo o que está na tela. */
export function SelectAllCheckbox({ selection, total, className }: { selection: Selection; total: number; className?: string }) {
  const count = selection.selectedIds.length;
  return (
    <SelectCheckbox
      checked={selection.allSelected}
      mixed={count > 0 && !selection.allSelected}
      label={selection.allSelected ? "Desmarcar todos" : `Selecionar todos os ${total}`}
      onChange={selection.toggleAll}
      className={className}
    />
  );
}

/** No celular não tem cabeçalho de tabela: a opção de marcar tudo fica acima dos cards. */
export function MobileSelectAll({ selection, total }: { selection: Selection; total: number }) {
  return (
    <div className="-my-1 flex items-center gap-1 text-sm text-mist lg:hidden">
      <SelectAllCheckbox selection={selection} total={total} className="-ml-2" />
      <span aria-hidden>{selection.allSelected ? "Desmarcar todos" : "Selecionar todos"}</span>
    </div>
  );
}

export function RowTrashButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title="Apagar"
      className="relative z-10 grid size-9 place-items-center rounded-full text-mist hover:bg-alert/10 hover:text-alert focus-visible:outline-2 focus-visible:outline-electric"
    >
      <Trash2 aria-hidden className="size-4" />
    </button>
  );
}

interface SelectionBarProps {
  selection: Selection;
  noun: Noun;
  onDelete: () => void;
}

/** Aparece quando há linhas marcadas: quantas, limpar e a lixeira. Fica acima da barra de navegação no celular. */
export function SelectionBar({ selection, noun, onDelete }: SelectionBarProps) {
  const reduceMotion = useReducedMotion();
  const count = selection.selectedIds.length;
  return (
    <AnimatePresence>
      {count > 0 && (
        <motion.div
          role="region"
          aria-label="Itens selecionados"
          initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-md items-center gap-2 rounded-full border border-line-strong bg-surface/95 py-2 pr-2 pl-4 shadow-[0_18px_50px_-12px_rgb(0_0_0/0.8)] backdrop-blur-xl md:bottom-6 md:left-64"
        >
          <p aria-live="polite" className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
            {countOf(count, noun)} selecionad{noun.feminine ? "a" : "o"}
            {count === 1 ? "" : "s"}
          </p>
          <button
            type="button"
            onClick={selection.clear}
            aria-label="Limpar seleção"
            title="Limpar seleção"
            className="grid size-9 place-items-center rounded-full text-mist hover:bg-white/[0.06] hover:text-white"
          >
            <X aria-hidden className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-alert px-4 text-sm font-semibold text-white hover:bg-[#ff4d4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Trash2 aria-hidden className="size-4" /> Apagar
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface DeleteDialogProps {
  open: boolean;
  count: number;
  noun: Noun;
  /** Nome de quem vai ser apagado, quando é um só. */
  singleName: string | null;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** O que acontece depois de apagar, em uma frase. */
  consequence: ReactNode;
}

export function DeleteDialog({ open, count, noun, singleName, busy, onConfirm, onClose, consequence }: DeleteDialogProps) {
  const fallback = `${noun.feminine ? "esta" : "este"} ${noun.one}`;
  const title = count === 1 ? `Apagar ${singleName ?? fallback}?` : `Apagar ${countOf(count, noun)}?`;
  return (
    <ConfirmDialog
      open={open}
      title={title}
      description={consequence}
      confirmLabel={count === 1 ? "Apagar" : `Apagar ${count}`}
      pending={busy}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
