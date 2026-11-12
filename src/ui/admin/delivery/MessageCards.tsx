import { Pencil, Star } from "lucide-react";
import { cn } from "@/ui/lib/cn";
import type { MessageChoice, MessageOption } from "./use-delivery-messages";

/** Primeira linha com texto, sem as marcas de negrito, para reconhecer a mensagem no card. */
const snippetOf = (body: string) => (body.split("\n").find((line) => line.trim()) ?? "").replace(/\*/g, "").trim();

interface MessageCardsProps {
  options: readonly MessageOption[];
  selected: MessageChoice;
  editing: boolean;
  disabled: boolean;
  onSelect: (choice: MessageChoice) => void;
  onEdit: () => void;
}

/** Botão de editar e as mensagens prontas (a padrão e as salvas), lado a lado e arrastáveis no celular. */
export function MessageCards({ options, selected, editing, disabled, onSelect, onEdit }: MessageCardsProps) {
  return (
    <div role="group" aria-label="Mensagens prontas" className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
      <button
        type="button"
        onClick={onEdit}
        disabled={disabled}
        aria-pressed={editing}
        className={cn(
          "flex w-32 shrink-0 snap-start flex-col justify-between gap-3 rounded-2xl border border-dashed p-3 text-left text-sm transition-colors disabled:opacity-50",
          editing ? "border-electric bg-electric/10 text-white" : "border-line-strong text-fog hover:border-electric hover:text-white",
        )}
      >
        <Pencil aria-hidden className="size-4 text-electric" />
        <span className="font-medium">Editar mensagem</span>
      </button>
      {options.map((option) => {
        const active = option.choice === selected;
        return (
          <button
            key={option.choice}
            type="button"
            onClick={() => onSelect(option.choice)}
            disabled={disabled}
            aria-pressed={active}
            className={cn(
              "flex w-44 shrink-0 snap-start flex-col gap-1.5 rounded-2xl border p-3 text-left transition-colors disabled:opacity-50",
              active ? "border-electric bg-electric/10" : "border-line bg-white/[0.02] hover:border-line-strong hover:bg-white/[0.05]",
            )}
          >
            <span className="flex items-center gap-1.5 text-sm font-medium text-white">
              {option.choice === "default" && <Star aria-hidden className="size-3.5 shrink-0 fill-current text-amber-300" />}
              <span className="truncate">{option.name}</span>
            </span>
            <span className="line-clamp-2 text-xs leading-snug text-mist">{snippetOf(option.body)}</span>
          </button>
        );
      })}
    </div>
  );
}
