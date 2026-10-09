import { CheckCircle2, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";

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

interface FlashState {
  flash?: string;
}

/** Mensagem de sucesso que chega pela navegação (ex.: "Conta salva") e some sozinha. */
export function FlashNotice() {
  const location = useLocation();
  const navigate = useNavigate();
  const incoming = (location.state as FlashState | null)?.flash;
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    if (!incoming) return;
    setText(incoming);
    // Limpa do histórico para a mensagem não voltar ao recarregar ou navegar de volta.
    navigate(location.pathname + location.search, { replace: true, state: null });
  }, [incoming, navigate, location.pathname, location.search]);

  useEffect(() => {
    if (!text) return;
    const timer = setTimeout(() => setText(null), 5000);
    return () => clearTimeout(timer);
  }, [text]);

  if (!text) return null;
  return (
    <div
      role="status"
      className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-200"
    >
      <span className="flex items-center gap-2">
        <CheckCircle2 aria-hidden className="size-4" />
        {text}
      </span>
      <button type="button" onClick={() => setText(null)} aria-label="Fechar aviso" className="rounded-full p-1 hover:bg-white/10">
        <X aria-hidden className="size-4" />
      </button>
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
