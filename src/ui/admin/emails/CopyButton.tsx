import { Copy, type LucideIcon } from "lucide-react";
import { cn } from "@/ui/lib/cn";

interface CopyButtonProps {
  label: string;
  onCopy: () => void;
  pending?: boolean;
  /** Diferencia o que é copiado quando há mais de um botão lado a lado (ex.: chave para a senha). */
  icon?: LucideIcon;
  className?: string;
}

/** Botão de ícone para copiar; o rótulo vai para leitores de tela e para a dica do mouse. */
export function CopyButton({ label, onCopy, pending = false, icon: Icon = Copy, className }: CopyButtonProps) {
  return (
    <button
      type="button"
      onClick={onCopy}
      disabled={pending}
      aria-label={label}
      title={label}
      className={cn(
        "relative z-10 grid size-9 shrink-0 place-items-center rounded-full text-mist transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric disabled:opacity-50",
        className,
      )}
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}
