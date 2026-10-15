import { CalendarClock, CircleCheck, Handshake, PackageCheck, Wallet, type LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import type { Dashboard } from "@/domain/dashboard";
import { formatBRL } from "@/domain/money";
import { ToneIcon, type Tone } from "./StatCard";

interface Pending {
  to: string;
  icon: LucideIcon;
  tone: Tone;
  value: string;
  /** Texto depois do número, já no singular ou no plural. */
  label: string;
}

const choose = (count: number, one: string, many: string) => (count === 1 ? one : many);

function pendingOf(dashboard: Dashboard): Pending[] {
  const { awaitingPayment, awaitingDelivery, followUpsDue, commissionThisMonth } = dashboard;
  const items: (Pending & { show: boolean })[] = [
    {
      show: awaitingPayment > 0,
      to: "/admin/pedidos",
      icon: Wallet,
      tone: "amber",
      value: String(awaitingPayment),
      label: choose(awaitingPayment, "pedido aguardando pagamento", "pedidos aguardando pagamento"),
    },
    {
      show: awaitingDelivery > 0,
      to: "/admin/pedidos",
      icon: PackageCheck,
      tone: "electric",
      value: String(awaitingDelivery),
      label: choose(awaitingDelivery, "pedido pago para entregar", "pedidos pagos para entregar"),
    },
    {
      show: followUpsDue > 0,
      to: "/admin/crm",
      icon: CalendarClock,
      tone: "pink",
      value: String(followUpsDue),
      label: choose(followUpsDue, "retorno do CRM para hoje ou atrasado", "retornos do CRM para hoje ou atrasados"),
    },
    {
      show: commissionThisMonth > 0,
      to: "/admin/parceiros",
      icon: Handshake,
      tone: "emerald",
      value: formatBRL(commissionThisMonth),
      label: "de comissão de parceiros no mês",
    },
  ];
  return items.filter((item) => item.show);
}

/** O que está esperando o Jota agir, logo no topo. */
export function PendingStrip({ dashboard }: { dashboard: Dashboard }) {
  const pending = pendingOf(dashboard);
  if (pending.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-2xl border border-emerald-400/20 bg-emerald-400/[0.05] px-4 py-3 text-sm text-fog">
        <CircleCheck aria-hidden className="size-4 text-emerald-300" /> Tudo em dia: nenhum pedido ou retorno esperando por você.
      </p>
    );
  }
  return (
    <ul aria-label="Precisa de você" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
      {pending.map((item) => (
        <li key={item.label}>
          <Link
            to={item.to}
            className="group flex h-full items-center gap-3 rounded-2xl border border-line bg-surface/70 px-4 py-3 transition-colors hover:border-line-strong hover:bg-surface"
          >
            <ToneIcon icon={item.icon} tone={item.tone} />
            <span className="text-sm leading-snug text-fog group-hover:text-white">
              <strong className="font-display font-semibold text-white tabular-nums">{item.value}</strong> {item.label}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
