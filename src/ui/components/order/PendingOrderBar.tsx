import { ArrowRight, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { readPendingOrder, subscribePendingOrder, type PendingOrder } from "@/ui/lib/pending-order";

const TICK_MS = 1000;

const clock = (ms: number) => {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
};

/**
 * Faixa fixa em todo o site enquanto há pedido esperando pagamento neste navegador.
 * Quem saiu para pagar e voltou para outra página tem um toque para voltar ao QR Code ou ao cartão.
 */
export function PendingOrderBar() {
  const { pathname } = useLocation();
  const [pending, setPending] = useState<PendingOrder | null>(() => readPendingOrder());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => subscribePendingOrder(() => setPending(readPendingOrder())), []);

  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, [pending]);

  if (!pending) return null;
  const left = Date.parse(pending.expiresAt) - now;
  if (left <= 0 || pathname === `/pedido/${pending.code}`) return null;

  return (
    <div className="fixed inset-x-3 top-[4.25rem] z-40 sm:inset-x-auto sm:right-6 sm:top-20 sm:w-[24rem]">
      <Link
        to={`/pedido/${pending.code}`}
        className="flex items-center gap-3 rounded-2xl border border-electric/40 bg-ink/95 p-3.5 shadow-[0_20px_60px_-20px_rgb(39_153_255/0.6)] backdrop-blur-xl transition-colors hover:border-electric focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-electric/15 text-electric">
          <Timer aria-hidden className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-left">
          <span className="block text-sm font-semibold text-white">Seu pedido está esperando o pagamento</span>
          <span className="block text-xs text-mist">
            {pending.code} · reserva por mais <span className="font-mono tabular-nums text-fog">{clock(left)}</span>
          </span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-electric-soft">
          Pagar <ArrowRight aria-hidden className="size-4" />
        </span>
      </Link>
    </div>
  );
}
