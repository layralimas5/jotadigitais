import { Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { RESERVATION_HOLD_MINUTES } from "@/domain/order";
import { cn } from "@/ui/lib/cn";

const TICK_MS = 1000;
/** No último minuto e meio o relógio fica em alerta. */
const URGENT_SECONDS = 90;

function secondsUntil(iso: string): number {
  return Math.max(0, Math.floor((new Date(iso).getTime() - Date.now()) / 1000));
}

const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

/**
 * Contagem da reserva na página do pedido: deixa claro quanto tempo o cliente tem para pagar.
 * Vencido, avisa que a conta volta para a vitrine (o pg_cron cancela o pedido logo depois).
 */
export function ReservationTimer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [left, setLeft] = useState(() => secondsUntil(expiresAt));

  useEffect(() => {
    setLeft(secondsUntil(expiresAt));
    const timer = window.setInterval(() => setLeft(secondsUntil(expiresAt)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const expired = left === 0;
  useEffect(() => {
    if (expired) onExpire();
  }, [expired, onExpire]);

  if (expired) {
    return (
      <p role="status" className="mx-auto mt-6 max-w-md rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-4 text-sm text-amber-100">
        O tempo para pagar acabou e a conta voltou para a vitrine. Se você já pagou, fale com o suporte com o código do pedido.
      </p>
    );
  }

  const urgent = left <= URGENT_SECONDS;
  return (
    <div
      className={cn(
        "mx-auto mt-6 flex max-w-md items-center gap-3 rounded-2xl border p-4 text-left",
        urgent ? "border-amber-300/40 bg-amber-300/[0.08]" : "border-electric/30 bg-electric/[0.06]",
      )}
    >
      <Timer aria-hidden className={cn("size-6 shrink-0", urgent ? "text-amber-200" : "text-electric")} />
      <p className="text-sm text-fog">
        Pague em até{" "}
        <span
          role="timer"
          aria-label={`${Math.ceil(left / 60)} minutos restantes`}
          className={cn("font-mono text-base font-semibold tabular-nums", urgent ? "text-amber-100" : "text-white")}
        >
          {clock(left)}
        </span>{" "}
        para garantir a conta. A reserva dura {RESERVATION_HOLD_MINUTES} minutos; depois disso ela volta para a vitrine.
      </p>
    </div>
  );
}
