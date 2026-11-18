import { ChevronRight, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { loadAffiliatesBoard, type AffiliateSummary } from "@/application/affiliate-use-cases";
import { formatBRL } from "@/domain/money";
import { AffiliateStatusBadge } from "@/ui/components/affiliate/AffiliateBadges";
import { ButtonLink } from "@/ui/components/Button";
import { ErrorState } from "@/ui/components/StateViews";
import { affiliatePreviewPath } from "../affiliates/AffiliatePreviewRoot";
import { LoadingBlock } from "../components/AdminUi";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminQuery } from "../hooks";
import { formatDate } from "../lib/dates";
import { formatPhone } from "../lib/whatsapp";

export const affiliateAccessPath = (id: string) => `/admin/acessos/afiliados/${id}`;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-ink/50 px-3 py-2">
      <dt className="text-xs text-mist">{label}</dt>
      <dd className="truncate text-sm font-medium text-white tabular-nums">{value}</dd>
    </div>
  );
}

/** Cartão no mesmo formato dos usuários da equipe: inteiro abre a ficha; "Ver como" abre o painel do afiliado. */
function AffiliateAccessCard({ summary }: { summary: AffiliateSummary }) {
  const { affiliate, totals } = summary;
  return (
    <li className="relative rounded-3xl border border-line bg-surface/60 p-4 transition-colors hover:border-line-strong hover:bg-surface sm:p-5">
      <div className="flex items-center gap-4">
        <PersonAvatar name={affiliate.name} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2">
            <Link
              to={affiliateAccessPath(affiliate.id)}
              className="truncate font-semibold text-white after:absolute after:inset-0 after:rounded-3xl hover:text-electric-soft focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-electric"
            >
              {affiliate.name}
            </Link>
            <span className="rounded-full border border-violet/50 bg-violet/15 px-2 py-0.5 text-[0.68rem] font-semibold text-white">Afiliado</span>
            <AffiliateStatusBadge status={affiliate.status} />
          </p>
          <p className="mt-0.5 truncate text-sm text-fog">{affiliate.email}</p>
          <p className="text-xs text-mist">{affiliate.whatsapp ? `WhatsApp ${formatPhone(affiliate.whatsapp)}` : "Sem WhatsApp cadastrado"}</p>
        </div>
        <span className="hidden items-center gap-1 text-sm font-medium text-electric-soft sm:flex">
          Abrir ficha <ChevronRight aria-hidden className="size-4" />
        </span>
        <ChevronRight aria-hidden className="size-5 text-mist sm:hidden" />
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Fact label="Código" value={affiliate.code} />
        <Fact label="Cadastro" value={formatDate(affiliate.createdAt)} />
        <Fact label="Vendas" value={String(totals.sales)} />
        <Fact label="Liberado" value={formatBRL(totals.released)} />
      </dl>
      <div className="relative z-10 mt-4 flex justify-end border-t border-line pt-4">
        <ButtonLink to={affiliatePreviewPath(affiliate.id)} variant="secondary" aria-label={`Ver o painel como ${affiliate.name}`}>
          <Eye aria-hidden className="size-4" /> Ver como
        </ButtonLink>
      </div>
    </li>
  );
}

/** Afiliados dentro de Acessos: cada um com a ficha e o "Ver como" do painel dele. */
export function AffiliateAccessList() {
  const board = useAdminQuery(loadAffiliatesBoard, "access-affiliates");

  return (
    <section aria-labelledby="access-affiliates-title" className="space-y-3">
      <h2 id="access-affiliates-title" className="font-display text-lg font-semibold text-white">
        Afiliados
        {board.status === "success" && <span className="ml-2 text-sm font-normal text-mist tabular-nums">{board.data.summaries.length}</span>}
      </h2>
      {board.status === "loading" && <LoadingBlock />}
      {board.status === "error" && <ErrorState message={board.error.message} onRetry={board.reload} />}
      {board.status === "success" && board.data.summaries.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface/60 px-4 py-3 text-sm text-mist">Nenhum afiliado cadastrado ainda.</p>
      )}
      {board.status === "success" && board.data.summaries.length > 0 && (
        <ul aria-label="Afiliados" className="grid gap-3">
          {board.data.summaries.map((summary) => (
            <AffiliateAccessCard key={summary.affiliate.id} summary={summary} />
          ))}
        </ul>
      )}
    </section>
  );
}
