import { ShieldCheck, ShieldOff } from "lucide-react";
import type { Order } from "@/domain/order";
import { warrantyOf } from "@/domain/sale";
import { cn } from "@/ui/lib/cn";
import { formatDate } from "../lib/dates";

/** Garantia de um pedido entregue: dias que faltam ou quando acabou. */
export function WarrantyBadge({ order, guaranteeDays }: { order: Order; guaranteeDays: number }) {
  const warranty = warrantyOf(order, guaranteeDays);
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        warranty.active ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : "border-white/15 bg-white/[0.05] text-mist",
      )}
    >
      {warranty.active ? <ShieldCheck aria-hidden className="size-3.5" /> : <ShieldOff aria-hidden className="size-3.5" />}
      {warranty.active
        ? `Em garantia, ${warranty.daysLeft === 1 ? "falta 1 dia" : `faltam ${warranty.daysLeft} dias`}`
        : `Garantia encerrada em ${formatDate(warranty.endsAt.toISOString())}`}
    </span>
  );
}
