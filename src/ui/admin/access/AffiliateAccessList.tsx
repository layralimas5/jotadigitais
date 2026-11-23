import { ChevronRight, Eye } from "lucide-react";
import { useState } from "react";
import { loadAffiliatesBoard, type AffiliateSummary } from "@/application/affiliate-use-cases";
import { formatBRL } from "@/domain/money";
import { AffiliateStatusBadge } from "@/ui/components/affiliate/AffiliateBadges";
import { ButtonLink } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { affiliatePreviewPath } from "../affiliates/AffiliatePreviewRoot";
import { LoadingBlock } from "../components/AdminUi";
import { Modal } from "../components/Modal";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminQuery } from "../hooks";
import { formatDate } from "../lib/dates";
import { formatPhone } from "../lib/whatsapp";

export const affiliateAccessPath = (id: string) => `/admin/acessos/afiliados/${id}`;

function AffiliateBadge() {
  return <span className="rounded-full border border-violet/50 bg-violet/15 px-2 py-0.5 text-[0.68rem] font-semibold text-white">Afiliado</span>;
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-ink/50 px-3 py-2">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="truncate text-sm font-medium text-white tabular-nums">{value}</dd>
    </div>
  );
}

function AffiliateRow({ summary, onOpen }: { summary: AffiliateSummary; onOpen: () => void }) {
  const { affiliate } = summary;
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03] focus-visible:bg-white/[0.04] focus-visible:outline-none sm:px-5"
      >
        <PersonAvatar name={affiliate.name} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="truncate font-semibold text-white">{affiliate.name}</span>
            <AffiliateBadge />
            <AffiliateStatusBadge status={affiliate.status} />
          </span>
          <span className="block truncate text-sm text-mist">{affiliate.email}</span>
        </span>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-mist" />
      </button>
    </li>
  );
}

/** Card flutuante do afiliado: dados, números e o caminho para a ficha e para o "Ver como". */
function AffiliateDetailCard({ summary, onClose }: { summary: AffiliateSummary | null; onClose: () => void }) {
  return (
    <Modal open={summary !== null} title={summary?.affiliate.name ?? ""} onClose={onClose} placement="center">
      {summary && (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <PersonAvatar name={summary.affiliate.name} />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2">
                <AffiliateBadge />
                <AffiliateStatusBadge status={summary.affiliate.status} />
              </p>
              <p className="mt-1 truncate text-sm text-fog">{summary.affiliate.email}</p>
              <p className="text-xs text-mist">{summary.affiliate.whatsapp ? `WhatsApp ${formatPhone(summary.affiliate.whatsapp)}` : "Sem WhatsApp cadastrado"}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-2">
            <Fact label="Código" value={summary.affiliate.code} />
            <Fact label="Cadastro" value={formatDate(summary.affiliate.createdAt)} />
            <Fact label="Cliques" value={String(summary.clicks)} />
            <Fact label="Vendas" value={String(summary.totals.sales)} />
            <Fact label="Pendente" value={formatBRL(summary.totals.pending)} />
            <Fact label="Liberado" value={formatBRL(summary.totals.released)} />
          </dl>
          <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
            <ButtonLink to={affiliatePreviewPath(summary.affiliate.id)} variant="secondary">
              <Eye aria-hidden className="size-4" /> Ver como
            </ButtonLink>
            <ButtonLink to={affiliateAccessPath(summary.affiliate.id)}>
              Abrir ficha <ChevronRight aria-hidden className="size-4" />
            </ButtonLink>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Afiliados dentro de Acessos: lista; o clique abre o card com a ficha e o "Ver como" do painel dele. */
export function AffiliateAccessList() {
  const board = useAdminQuery(loadAffiliatesBoard, "access-affiliates");
  const [openId, setOpenId] = useState<string | null>(null);
  const summaries = board.status === "success" ? board.data.summaries : [];
  const open = summaries.find((summary) => summary.affiliate.id === openId) ?? null;

  return (
    <section aria-labelledby="access-affiliates-title" className="space-y-3">
      <h2 id="access-affiliates-title" className="font-display text-lg font-semibold text-white">
        Afiliados
        {board.status === "success" && <span className="ml-2 text-sm font-normal text-mist tabular-nums">{summaries.length}</span>}
      </h2>
      {board.status === "loading" && <LoadingBlock />}
      {board.status === "error" && <ErrorState message={board.error.message} onRetry={board.reload} />}
      {board.status === "success" && summaries.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-mist">Nenhum afiliado cadastrado ainda.</p>
      )}
      {summaries.length > 0 && (
        <ul aria-label="Afiliados" className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface/60">
          {summaries.map((summary) => (
            <AffiliateRow key={summary.affiliate.id} summary={summary} onOpen={() => setOpenId(summary.affiliate.id)} />
          ))}
        </ul>
      )}
      <AffiliateDetailCard summary={open} onClose={() => setOpenId(null)} />
    </section>
  );
}
