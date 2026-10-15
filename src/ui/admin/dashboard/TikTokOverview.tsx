import { BadgeCheck, Hourglass, Heart, PackageOpen, Tag, TrendingUp, UserRound, Users } from "lucide-react";
import { FULL_SHOP_MIN_FOLLOWERS, formatCount } from "@/domain/account";
import type { Dashboard } from "@/domain/dashboard";
import { formatBRL } from "@/domain/money";
import { TikTokGlyph } from "@/ui/components/TikTokGlyph";
import { SegmentBar, StatCard, TONE } from "./StatCard";

export function TikTokOverview({ dashboard }: { dashboard: Dashboard }) {
  const { tiktok } = dashboard;
  const inStock = tiktok.fullShop + tiktok.pilotShop;
  return (
    <div className="relative overflow-hidden rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <div aria-hidden className="pointer-events-none absolute -top-24 -left-10 size-60 rounded-full bg-[#25f4ee]/[0.07] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -bottom-28 size-64 rounded-full bg-[#fe2c55]/[0.08] blur-3xl" />

      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span aria-hidden className="grid size-11 place-items-center rounded-2xl bg-white text-ink shadow-[3px_3px_0_#fe2c55,-3px_-3px_0_#25f4ee]">
            <TikTokGlyph className="size-5" />
          </span>
          <div>
            <p className="font-display text-base font-semibold text-white">Contas do TikTok</p>
            <p className="text-xs text-mist">
              {tiktok.status.total} cadastradas · {tiktok.salesThisMonth} {tiktok.salesThisMonth === 1 ? "venda" : "vendas"} no mês,{" "}
              {formatBRL(tiktok.revenueThisMonth)}
            </p>
          </div>
        </div>
        <div className="w-full sm:w-72">
          <p className="flex justify-between text-xs text-mist">
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: TONE.emerald.fill }} />
              Shop completo <span className="text-fog tabular-nums">{tiktok.fullShop}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="size-2 rounded-full" style={{ background: TONE.amber.fill }} />
              Modo piloto <span className="text-fog tabular-nums">{tiktok.pilotShop}</span>
            </span>
          </p>
          <SegmentBar
            className="mt-2"
            segments={[
              { label: "Completo", value: tiktok.fullShop, tone: "emerald" },
              { label: "Piloto", value: tiktok.pilotShop, tone: "amber" },
            ]}
          />
          <p className="mt-1.5 text-[0.7rem] text-mist">
            {inStock} no estoque · completo a partir de {formatCount(FULL_SHOP_MIN_FOLLOWERS)} seguidores
          </p>
        </div>
      </div>

      <dl className="relative mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ativas" value={String(tiktok.status.available)} icon={PackageOpen} tone="electric" hint="À venda agora" />
        <StatCard label="Reservadas" value={String(tiktok.status.reserved)} icon={Hourglass} tone="pink" hint="Com pedido segurando" />
        <StatCard label="Compradas" value={String(tiktok.status.sold)} icon={BadgeCheck} tone="emerald" hint="Já vendidas" />
        <StatCard label="Preço médio" value={formatBRL(tiktok.averagePrice)} icon={Tag} tone="amber" hint="Das ativas" />
        <StatCard label="Seguidores no estoque" value={formatCount(tiktok.followersInStock)} icon={Users} tone="electric" hint="Somando as não vendidas" />
        <StatCard label="Média de seguidores" value={formatCount(tiktok.averageFollowers)} icon={UserRound} tone="pink" hint="Por conta no estoque" />
        <StatCard label="Curtidas no estoque" value={formatCount(tiktok.likesInStock)} icon={Heart} tone="pink" hint="Somando as não vendidas" />
        <StatCard
          label="Faturado no mês"
          value={formatBRL(tiktok.revenueThisMonth)}
          icon={TrendingUp}
          tone="emerald"
          hint={`${tiktok.salesThisMonth} ${tiktok.salesThisMonth === 1 ? "pedido pago" : "pedidos pagos"}`}
        />
      </dl>
    </div>
  );
}
