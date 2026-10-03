import { RotateCcw, SearchX } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-3xl border border-alert/30 bg-alert/[0.06] p-8 text-center">
      <p className="font-display text-lg font-semibold text-white">Não conseguimos carregar agora.</p>
      <p className="mt-2 text-sm text-mist">{message}</p>
      <Button variant="secondary" className="mt-6" onClick={onRetry}>
        <RotateCcw className="size-4" /> Tentar de novo
      </Button>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-line-strong p-10 text-center">
      <SearchX aria-hidden className="mx-auto size-8 text-mist" />
      <p className="mt-4 font-display text-lg font-semibold text-white">{title}</p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-mist">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
