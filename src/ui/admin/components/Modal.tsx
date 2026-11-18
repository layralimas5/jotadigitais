import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { cn } from "@/ui/lib/cn";

interface ModalProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  /** "sheet" (padrão) vira folha de baixo no celular; "center" fica flutuando no meio da tela em qualquer tamanho. */
  placement?: "sheet" | "center";
}

/** O clique caiu no fundo escuro, fora da caixa da janela? */
function isOutside(dialog: HTMLElement, x: number, y: number): boolean {
  const box = dialog.getBoundingClientRect();
  return x < box.left || x > box.right || y < box.top || y > box.bottom;
}

/** Janela com `<dialog>` nativo: prende o foco, fecha no Esc e vira folha de baixo no celular. */
export function Modal({ open, title, description, onClose, children, placement = "sheet" }: ModalProps) {
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
      // No card flutuante, clicar fora (no fundo escuro) também fecha.
      onClick={placement === "center" ? (event) => event.detail > 0 && isOutside(event.currentTarget, event.clientX, event.clientY) && onClose() : undefined}
      aria-labelledby={titleId}
      className={cn(
        "m-auto max-h-[90dvh] w-[min(32rem,calc(100vw-2rem))] overflow-y-auto rounded-3xl border border-line-strong bg-surface p-6 text-white backdrop:bg-black/70 backdrop:backdrop-blur-sm",
        placement === "sheet" && "max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))]",
        placement === "center" && "max-sm:p-5",
      )}
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
