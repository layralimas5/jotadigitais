import { ExternalLink, Eye, FileSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { loadAffiliatesBoard, type AffiliateSummary } from "@/application/affiliate-use-cases";
import { AFFILIATE_STATUSES, AFFILIATE_STATUS_LABEL, commissionRuleLabel, type AffiliateStatus } from "@/domain/affiliate";
import { formatBRL } from "@/domain/money";
import { AffiliateStatusBadge } from "@/ui/components/affiliate/AffiliateBadges";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { affiliatePreviewPath, DEVELOPER_AFFILIATES_PATH } from "../affiliates/AffiliatePreviewRoot";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { Kpi } from "../components/Kpi";
import { PersonAvatar } from "../components/PersonAvatar";
import { SearchInput } from "../components/SearchInput";
import { useAdminQuery } from "../hooks";

type StatusFilter = AffiliateStatus | "all";
const STATUS_FILTERS = [{ value: "all" as const, label: "Todos" }, ...AFFILIATE_STATUSES.map((status) => ({ value: status, label: AFFILIATE_STATUS_LABEL[status] }))];

function matches(summary: AffiliateSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { name, email, code } = summary.affiliate;
  return name.toLowerCase().includes(needle) || email.toLowerCase().includes(needle) || code.includes(needle);
}

function AffiliateActions({ summary }: { summary: AffiliateSummary }) {
  const { id, name } = summary.affiliate;
  return (
    <div className="grid shrink-0 grid-cols-2 gap-2 lg:flex">
      <ButtonLink to={affiliatePreviewPath(id)} aria-label={`Ver o painel como ${name}`}>
        <Eye aria-hidden className="size-4" /> Ver como
      </ButtonLink>
      <ButtonLink to={`${DEVELOPER_AFFILIATES_PATH}/${id}`} variant="secondary" aria-label={`Abrir a ficha de ${name}`}>
        <FileSearch aria-hidden className="size-4" /> Ficha
      </ButtonLink>
    </div>
  );
}

/**
 * Afiliados no painel da desenvolvedora: conferir cada acesso por dentro. "Ver como" abre o painel do afiliado
 * exatamente como ele vê (só leitura); a ficha mostra o que o Jota vê dele.
 */
export default function DeveloperAffiliatesPage() {
  const board = useAdminQuery(loadAffiliatesBoard, "developer-affiliates");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const data = board.status === "success" ? board.data : null;
  const visible = useMemo(
    () => (data ? data.summaries.filter((summary) => (status === "all" || summary.affiliate.status === status) && matches(summary, query)) : []),
    [data, status, query],
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Afiliados" description="Confira cada afiliado por dentro: “Ver como” abre o painel dele do jeito que ele vê, só leitura." />
      {board.status === "loading" && <LoadingBlock />}
      {board.status === "error" && <ErrorState message={board.error.message} onRetry={board.reload} />}
      {data && (
        <>
          <section className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-4 text-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
            <p className="text-fog">
              Programa <strong className="text-white">{data.program.enabled ? "ligado" : "desligado"}</strong> ·{" "}
              {commissionRuleLabel(data.program.commission, formatBRL)} · link vale {data.program.linkDays} dias ·{" "}
              {data.program.autoApprove ? "aprova sozinho" : "Jota aprova um a um"}
            </p>
            <div className="flex flex-wrap gap-3">
              <Link to="/seja-afiliado" target="_blank" className="inline-flex items-center gap-1.5 font-medium text-electric hover:text-white">
                Seja afiliado <ExternalLink aria-hidden className="size-3.5" />
              </Link>
              <Link to="/afiliado/entrar" target="_blank" className="inline-flex items-center gap-1.5 font-medium text-electric hover:text-white">
                Login do afiliado <ExternalLink aria-hidden className="size-3.5" />
              </Link>
            </div>
          </section>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="Afiliados" value={String(data.summaries.length)} />
            <Kpi label="Esperando aprovação" value={String(data.summaries.filter((summary) => summary.affiliate.status === "pending").length)} />
            <Kpi label="Vendas de afiliados" value={String(data.totals.sales)} />
            <Kpi label="Comissão liberada" value={formatBRL(data.totals.released)} />
          </dl>

          {data.summaries.length === 0 ? (
            <EmptyState title="Nenhum afiliado ainda" description="Quando alguém se cadastrar em /seja-afiliado, aparece aqui." />
          ) : (
            <>
              <SearchInput label="Buscar afiliado" placeholder="Buscar por nome, e-mail ou código" value={query} onChange={setQuery} />
              <FilterChips label="Situação" value={status} options={STATUS_FILTERS} onChange={setStatus} />
              {visible.length === 0 ? (
                <EmptyState title="Ninguém encontrado" description="Confira a busca ou troque a situação." />
              ) : (
                <ul className="grid gap-2.5">
                  {visible.map((summary) => (
                    <li key={summary.affiliate.id} className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-surface/60 p-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <PersonAvatar name={summary.affiliate.name} />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-semibold text-white">{summary.affiliate.name}</span>
                            <AffiliateStatusBadge status={summary.affiliate.status} />
                          </p>
                          <p className="truncate text-xs text-mist">
                            <span className="font-mono">?ref={summary.affiliate.code}</span> · {summary.clicks} cliques · {summary.totals.sales}{" "}
                            {summary.totals.sales === 1 ? "venda" : "vendas"} · {formatBRL(summary.totals.released)} liberado
                          </p>
                        </div>
                      </div>
                      <AffiliateActions summary={summary} />
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
