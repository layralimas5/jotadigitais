import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({ title, description, action }: { title: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-mist">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <h2 className="font-display text-base font-semibold text-white">{title}</h2>
      {description && <p className="mt-1 text-xs text-mist">{description}</p>}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

/** Botão "+" no alcance do polegar, acima da barra de navegação. Só no celular. */
export function Fab({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      aria-label={label}
      className="fixed right-4 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-40 grid size-14 place-items-center rounded-full bg-electric text-ink shadow-[0_12px_40px_-8px_rgb(39_153_255/0.8)] transition-transform active:scale-90 md:hidden"
    >
      <Plus aria-hidden className="size-6" strokeWidth={2.5} />
    </Link>
  );
}

/** Barra fixa no rodapé do celular para a ação principal da tela (ex.: Salvar). */
export function MobileActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-black/90 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur-xl md:hidden">
      {children}
    </div>
  );
}

export function InlineError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-2xl border border-alert/30 bg-alert/[0.07] px-4 py-3 text-sm text-white">
      {message}
    </p>
  );
}

export function LoadingBlock({ label = "Carregando" }: { label?: string }) {
  return (
    <div className="grid min-h-[40vh] place-items-center" role="status" aria-label={label}>
      <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-electric" />
    </div>
  );
}
