import { useEffect, useId, useRef, type ReactNode } from "react";
import { Button } from "@/ui/components/Button";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
  /** Vermelho para apagar ou desfazer; verde para aprovar. */
  tone?: "danger" | "positive";
}

const CONFIRM_TONE = {
  danger: "bg-alert text-white shadow-none hover:bg-[#ff4d4d] hover:shadow-none",
  positive: "bg-emerald-400 text-ink shadow-none hover:bg-emerald-300 hover:shadow-none",
} as const;

/** `<dialog>` nativo: prende o foco, fecha no Esc e devolve o foco a quem abriu. */
export function ConfirmDialog({ open, title, description, confirmLabel, pending, onConfirm, onClose, tone = "danger" }: ConfirmDialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className="m-auto w-[min(26rem,calc(100vw-2rem))] rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] max-sm:open:animate-[sheet-up_0.25s_var(--ease-out-expo)]"
    >
      <h2 id={titleId} className="font-display text-lg font-semibold">
        {title}
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-mist">{description}</div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose} disabled={pending}>
          Voltar
        </Button>
        <Button onClick={onConfirm} disabled={pending} className={CONFIRM_TONE[tone]}>
          {pending ? "Aguarde…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
