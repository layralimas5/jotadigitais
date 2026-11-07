import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface ModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}

/** Janela com `<dialog>` nativo: prende o foco, fecha no Esc e vira folha de baixo no celular. */
export function Modal({ open, title, description, onClose, children }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

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
      className="m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id={titleId} className="font-display text-lg font-semibold">
            {title}
          </h2>
          {description && <div className="mt-1 text-sm text-mist">{description}</div>}
        </div>
        <button type="button" onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-mist hover:bg-white/[0.06] hover:text-white">
          <X aria-hidden className="size-5" />
        </button>
      </div>
      {open && <div className="mt-5">{children}</div>}
    </dialog>
  );
}
