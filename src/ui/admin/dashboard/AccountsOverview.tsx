import { BadgeCheck, Hourglass, PackageOpen } from "lucide-react";
import type { AccountStatusCount, Dashboard } from "@/domain/dashboard";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { cn } from "@/ui/lib/cn";
import { SegmentBar, TONE, ToneIcon, type Segment } from "./StatCard";

/** Cor de cada rede, a mesma do topo dos cards da vitrine: ícone em degradê e um brilho leve no fundo. */
const NETWORK_STYLE: Record<Platform, { chip: string; glow: string }> = {
  tiktok: { chip: "from-electric via-blue-500 to-sky-400 shadow-electric/30", glow: "from-electric/[0.12] hover:border-electric/40" },
  instagram: { chip: "from-pink via-fuchsia-500 to-rose-400 shadow-pink/30", glow: "from-pink/[0.12] hover:border-pink/40" },
  youtube: { chip: "from-red-500 via-red-400 to-rose-300 shadow-red-500/30", glow: "from-red-500/[0.12] hover:border-red-500/40" },
  facebook: { chip: "from-indigo-500 via-blue-600 to-violet-500 shadow-indigo-500/30", glow: "from-indigo-500/[0.14] hover:border-indigo-400/40" },
};

const STATUS_TILES = [
  { key: "available", label: "Ativas", hint: "À venda na vitrine", icon: PackageOpen, tone: "electric" },
  { key: "reserved", label: "Reservadas", hint: "Esperando pagamento ou entrega", icon: Hourglass, tone: "pink" },
  { key: "sold", label: "Compradas", hint: "Já vendidas", icon: BadgeCheck, tone: "emerald" },
] as const;

function statusSegments(status: AccountStatusCount): Segment[] {
  return STATUS_TILES.map((tile) => ({ label: tile.label, value: status[tile.key], tone: tile.tone }));
}

const share = (value: number, total: number) => (total ? Math.round((value / total) * 100) : 0);

export function AccountsOverview({ dashboard }: { dashboard: Dashboard }) {
  const { accounts } = dashboard;
  return (
    <div className="h-full rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-display text-base font-semibold text-white">{accounts.total} contas cadastradas</p>
        <p className="text-xs text-mist">
          Estoque ativo: <span className="text-fog tabular-nums">{formatBRL(dashboard.stockValue)}</span>
        </p>
      </div>

      <SegmentBar segments={statusSegments(accounts)} className="mt-4" />

      <dl className="mt-4 grid gap-2.5 sm:grid-cols-3">
        {STATUS_TILES.map((tile) => (
          <div key={tile.key} className="flex items-center gap-3 rounded-2xl border border-line bg-ink/50 p-3.5 sm:flex-col sm:items-start xl:flex-row xl:items-center">
            <ToneIcon icon={tile.icon} tone={tile.tone} />
            <div className="min-w-0">
              <dt className="flex items-center gap-1.5 text-xs text-mist">
                <span aria-hidden className="size-2 rounded-full" style={{ background: TONE[tile.tone].fill }} />
                {tile.label}
              </dt>
              <dd className="font-display text-2xl leading-tight font-semibold text-white tabular-nums">
                {accounts[tile.key]}
                <span className="ml-1.5 text-xs font-normal text-mist">{share(accounts[tile.key], accounts.total)}%</span>
              </dd>
              <dd className="text-[0.7rem] leading-snug text-mist">{tile.hint}</dd>
            </div>
          </div>
        ))}
      </dl>

      <p className="mt-5 text-xs font-medium text-mist">Ativas por rede</p>
      <ul className="mt-2 grid grid-cols-2 gap-2 2xl:grid-cols-4">
        {dashboard.stock.map((item) => (
          <li
            key={item.platform}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border border-line bg-gradient-to-r to-transparent px-2.5 py-2 text-sm transition-colors duration-300",
              NETWORK_STYLE[item.platform].glow,
            )}
          >
            <span
              aria-hidden
              className={cn("grid size-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white shadow-md", NETWORK_STYLE[item.platform].chip)}
            >
              <PlatformGlyph platform={item.platform} className="size-3.5" />
            </span>
            <span className="sr-only">{PLATFORM_LABEL[item.platform]}:</span>
            <span aria-hidden className="truncate text-xs text-fog">{PLATFORM_LABEL[item.platform]}</span>
            <span className="ml-auto font-semibold text-white tabular-nums">{item.available}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
