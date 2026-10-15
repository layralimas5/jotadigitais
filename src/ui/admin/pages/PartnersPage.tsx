import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listPartnerSummaries } from "@/application/admin-use-cases";
import { formatBRL } from "@/domain/money";
import type { PartnerSummary } from "@/domain/partner";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { Fab, LoadingBlock, PageHeader } from "../components/AdminUi";
import { Kpi } from "../components/Kpi";
import { PersonAvatar } from "../components/PersonAvatar";
import { SearchInput } from "../components/SearchInput";
import { useAdminQuery } from "../hooks";
import { formatPercent } from "../lib/percent";

const partnerPath = (summary: PartnerSummary) => `/admin/parceiros/${summary.partner.id}`;

function matches(summary: PartnerSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { name, instagram, whatsapp } = summary.partner;
  const digits = needle.replace(/\D/g, "");
  return (
    name.toLowerCase().includes(needle) ||
    (instagram ?? "").toLowerCase().includes(needle) ||
    (digits.length >= 3 && (whatsapp ?? "").includes(digits))
  );
}

function InactiveBadge() {
  return <span className="rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 text-[0.68rem] font-semibold text-mist">Inativo</span>;
}

function PartnerIdentity({ summary }: { summary: PartnerSummary }) {
  const { partner } = summary;
  return (
    <div className="flex min-w-0 items-center gap-3">
      <PersonAvatar name={partner.name} />
      <div className="min-w-0">
        <p className="flex items-center gap-2">
          <Link
            to={partnerPath(summary)}
            className="truncate font-semibold text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none"
          >
            {partner.name}
          </Link>
          {!partner.active && <InactiveBadge />}
        </p>
        <p className="truncate text-xs text-mist">{formatPercent(partner.commissionPercent)} de comissão</p>
      </div>
    </div>
  );
}

function PartnersTable({ summaries }: { summaries: PartnerSummary[] }) {
  return (
    <div className="hidden overflow-hidden rounded-3xl border border-line lg:block">
      <table className="w-full text-left text-sm">
        <thead className="bg-surface text-xs text-mist">
          <tr>
            <th scope="col" className="px-5 py-3 font-medium">Parceiro</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">No estoque</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Vendidas</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Vendas finalizadas</th>
            <th scope="col" className="px-4 py-3 text-right font-medium">Comissão</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {summaries.map((summary) => (
            <tr key={summary.partner.id} className="relative transition-colors hover:bg-white/[0.02]">
              <td className="px-5 py-3"><PartnerIdentity summary={summary} /></td>
              <td className="px-4 py-3 text-right text-fog tabular-nums">{summary.inStock}</td>
              <td className="px-4 py-3 text-right text-fog tabular-nums">{summary.sold}</td>
              <td className="px-4 py-3 text-right text-fog tabular-nums">{formatBRL(summary.revenue)}</td>
              <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{formatBRL(summary.commission)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PartnersCards({ summaries }: { summaries: PartnerSummary[] }) {
  return (
    <ul className="grid gap-2.5 lg:hidden">
      {summaries.map((summary) => (
        <li key={summary.partner.id} className="relative rounded-2xl border border-line bg-surface/60 p-4 active:bg-surface">
          <PartnerIdentity summary={summary} />
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
            <span className="text-fog">
              {summary.inStock} no estoque · {summary.sold} vendidas
            </span>
            <span className="font-semibold text-white tabular-nums">{formatBRL(summary.commission)}</span>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default function PartnersPage() {
  const summaries = useAdminQuery(listPartnerSummaries, "admin-partners");
  const [query, setQuery] = useState("");
  const data = summaries.status === "success" ? summaries.data : null;
  const visible = useMemo(() => (data ? data.filter((summary) => matches(summary, query)) : []), [data, query]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parceiros"
        description="Quem fornece contas para a loja. A comissão é calculada sobre as vendas finalizadas das contas de cada um."
        action={
          <ButtonLink to="/admin/parceiros/novo" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo parceiro
          </ButtonLink>
        }
      />

      {summaries.status === "loading" && <LoadingBlock />}
      {summaries.status === "error" && <ErrorState message={summaries.error.message} onRetry={summaries.reload} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Nenhum parceiro ainda"
          description="Cadastre quem te fornece contas e ligue cada conta ao parceiro dela no cadastro da conta."
          action={
            <ButtonLink to="/admin/parceiros/novo">
              <Plus aria-hidden className="size-4" /> Cadastrar parceiro
            </ButtonLink>
          }
        />
      )}
      {data && data.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3 [&>div:last-child]:col-span-2 lg:[&>div:last-child]:col-span-1">
            <Kpi label="Parceiros ativos" value={String(data.filter((summary) => summary.partner.active).length)} />
            <Kpi label="Contas de parceiros no estoque" value={String(data.reduce((sum, summary) => sum + summary.inStock, 0))} />
            <Kpi label="Comissão total" value={formatBRL(data.reduce((sum, summary) => sum + summary.commission, 0))} hint="Sobre todas as vendas finalizadas" />
          </dl>
          <SearchInput label="Buscar parceiro" placeholder="Buscar por nome, Instagram ou WhatsApp" value={query} onChange={setQuery} />
          {visible.length === 0 ? (
            <EmptyState title="Ninguém encontrado" description="Confira o nome ou o número digitado." />
          ) : (
            <>
              <PartnersTable summaries={visible} />
              <PartnersCards summaries={visible} />
            </>
          )}
        </>
      )}
      <Fab to="/admin/parceiros/novo" label="Novo parceiro" />
    </div>
  );
}
