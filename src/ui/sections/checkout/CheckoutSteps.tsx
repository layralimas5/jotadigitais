import { Check } from "lucide-react";
import type { CheckoutStep } from "@/ui/hooks/useCheckoutForm";
import { cn } from "@/ui/lib/cn";

const STEPS: readonly { id: CheckoutStep; label: string }[] = [
  { id: "profile", label: "Sua ficha" },
  { id: "payment", label: "Pagamento" },
];

/** "1 Sua ficha — 2 Pagamento", com o passo atual marcado para leitor de tela. */
export function CheckoutSteps({ current }: { current: CheckoutStep }) {
  const currentIndex = STEPS.findIndex((step) => step.id === current);
  return (
    <ol className="flex items-center gap-3 text-sm" aria-label="Etapas da compra">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={step.id} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            {index > 0 && <span aria-hidden className={cn("h-px w-8 sm:w-12", done || active ? "bg-electric" : "bg-line-strong")} />}
            <span
              aria-hidden
              className={cn(
                "grid size-7 place-items-center rounded-full border text-xs font-semibold",
                done && "border-electric bg-electric text-ink",
                active && "border-electric text-electric",
                !done && !active && "border-line-strong text-mist",
              )}
            >
              {done ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
            </span>
            <span className={cn("font-medium", active ? "text-white" : "text-mist")}>
              {step.label}
              {done && <span className="sr-only"> (concluído)</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
