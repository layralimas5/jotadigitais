import { BadgeCheck, Hourglass, PackageOpen } from "lucide-react";
import type { AccountStatusCount, Dashboard } from "@/domain/dashboard";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL } from "@/domain/platform";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { SegmentBar, TONE, ToneIcon, type Segment } from "./StatCard";

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
      <ul className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {dashboard.stock.map((item) => (
          <li key={item.platform} className="flex items-center gap-2 rounded-xl bg-white/[0.03] px-3 py-2 text-sm">
            <PlatformGlyph platform={item.platform} className="size-4 shrink-0 text-fog" />
            <span className="sr-only">{PLATFORM_LABEL[item.platform]}:</span>
            <span aria-hidden className="truncate text-xs text-mist">{PLATFORM_LABEL[item.platform]}</span>
            <span className="ml-auto font-semibold text-white tabular-nums">{item.available}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
