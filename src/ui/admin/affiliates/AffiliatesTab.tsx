import { Check, Download, Power, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { changeAffiliateStatus, type AffiliateSummary, type AffiliatesBoard } from "@/application/affiliate-use-cases";
import {
  AFFILIATE_STATUSES,
  AFFILIATE_STATUS_LABEL,
  COMMISSION_STATE_LABEL,
  COMMISSION_VIA_LABEL,
  commissionStateOf,
  type AffiliateStatus,
} from "@/domain/affiliate";
import { formatBRL } from "@/domain/money";
import { AffiliateStatusBadge } from "@/ui/components/affiliate/AffiliateBadges";
import { Button } from "@/ui/components/Button";
import { EmptyState } from "@/ui/components/StateViews";
import { csvMoney, downloadCsv } from "@/ui/lib/csv";
import { InlineError } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { Kpi } from "../components/Kpi";
import { PersonAvatar } from "../components/PersonAvatar";
import { SearchInput } from "../components/SearchInput";
import { useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { useToast } from "../toast";
import { AffiliateInvitesSection } from "./AffiliateInvites";

type StatusFilter = AffiliateStatus | "all";

const STATUS_FILTERS = [{ value: "all" as const, label: "Todos" }, ...AFFILIATE_STATUSES.map((status) => ({ value: status, label: AFFILIATE_STATUS_LABEL[status] }))];

export const affiliatePath = (id: string) => `/admin/parceiros/afiliados/${id}`;

function matches(summary: AffiliateSummary, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const { name, email, code, whatsapp } = summary.affiliate;
  const digits = needle.replace(/\D/g, "");
  return (
    name.toLowerCase().includes(needle) ||
    email.toLowerCase().includes(needle) ||
    code.includes(needle) ||
    (digits.length >= 3 && (whatsapp ?? "").includes(digits))
  );
}

const conversionLabel = (value: number | null) => (value === null ? "Sem cliques" : `${value.toLocaleString("pt-BR")}%`);

function exportCommissions(board: AffiliatesBoard) {
  const names = new Map(board.summaries.map((summary) => [summary.affiliate.id, summary.affiliate.name]));
  downloadCsv(`comissoes-afiliados-${localIsoDate()}.csv`, [
    ["Data", "Pedido", "Afiliado", "Conta", "Origem", "Valor da venda", "Comissão", "Situação", "Libera em"],
    ...board.commissions.map((commission) => [
      commission.createdAt.slice(0, 10),
      commission.orderCode,
      names.get(commission.affiliateId) ?? "",
      commission.accountHandle,
      COMMISSION_VIA_LABEL[commission.via],
      csvMoney(commission.base),
      csvMoney(commission.amount),
      COMMISSION_STATE_LABEL[commissionStateOf(commission)],
      commission.releaseAt?.slice(0, 10) ?? "",
    ]),
  ]);
}

function PendingApprovals({ pending, onDone }: { pending: AffiliateSummary[]; onDone: () => void }) {
  const toast = useToast();
  const change = useMutation(async (deps, id: string, status: AffiliateStatus) => {
    await changeAffiliateStatus(deps, id, { status, statusNote: null });
    return true;
  });

  const decide = async (summary: AffiliateSummary, status: AffiliateStatus) => {
    const done = await change.run(summary.affiliate.id, status);
    if (!done) return;
    toast.show(status === "approved" ? `${summary.affiliate.name} aprovado. Os links já valem.` : `Cadastro de ${summary.affiliate.name} recusado.`);
    onDone();
  };

  return (
    <section aria-labelledby="pending-title" className="rounded-3xl border border-amber-400/30 bg-amber-400/[0.04] p-4 sm:p-5">
      <h2 id="pending-title" className="font-display text-base font-semibold text-white">
        Esperando sua aprovação ({pending.length})
      </h2>
      <p className="mt-1 text-sm text-mist">Até aprovar, o link da pessoa não conta clique nem venda.</p>
      {change.error && <div className="mt-3"><InlineError message={change.error.message} /></div>}
      <ul className="mt-4 grid gap-2.5">
        {pending.map((summary) => (
          <li key={summary.affiliate.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface/70 p-3.5 sm:flex-row sm:items-center sm:justify-between">
            <Link to={affiliatePath(summary.affiliate.id)} className="flex min-w-0 items-center gap-3 hover:text-electric-soft">
              <PersonAvatar name={summary.affiliate.name} />
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{summary.affiliate.name}</span>
                <span className="block truncate text-xs text-mist">{summary.affiliate.email}</span>
              </span>
            </Link>
            <div className="flex shrink-0 gap-2">
              <Button variant="secondary" disabled={change.pending} onClick={() => void decide(summary, "rejected")}>
                <X aria-hidden className="size-4" /> Recusar
              </Button>
              <Button disabled={change.pending} onClick={() => void decide(summary, "approved")}>
                <Check aria-hidden className="size-4" /> Aprovar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function AffiliateRow({ summary }: { summary: AffiliateSummary }) {
  const { affiliate, totals } = summary;
  return (
    <tr className="relative transition-colors hover:bg-white/[0.02]">
      <td className="py-3 pr-4 pl-5">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={affiliate.name} />
          <div className="min-w-0">
            <Link to={affiliatePath(affiliate.id)} className="block truncate font-semibold text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none">
              {affiliate.name}
            </Link>
            <p className="truncate font-mono text-xs text-mist">?ref={affiliate.code}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3"><AffiliateStatusBadge status={affiliate.status} /></td>
      <td className="px-4 py-3 text-right text-fog tabular-nums">{summary.clicks}</td>
      <td className="px-4 py-3 text-right text-fog tabular-nums">{totals.sales}</td>
      <td className="px-4 py-3 text-right text-fog tabular-nums">{conversionLabel(summary.conversion)}</td>
      <td className="px-4 py-3 text-right text-fog tabular-nums">{formatBRL(totals.pending)}</td>
      <td className="px-4 py-3 text-right font-semibold text-white tabular-nums">{formatBRL(totals.balance)}</td>
    </tr>
  );
}

function AffiliateCard({ summary }: { summary: AffiliateSummary }) {
  const { affiliate, totals } = summary;
  return (
    <li className="relative rounded-2xl border border-line bg-surface/60 p-4 active:bg-surface">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={affiliate.name} />
          <div className="min-w-0">
            <Link to={affiliatePath(affiliate.id)} className="block truncate font-semibold text-white after:absolute after:inset-0 focus-visible:outline-none">
              {affiliate.name}
            </Link>
            <p className="truncate font-mono text-xs text-mist">?ref={affiliate.code}</p>
          </div>
        </div>
        <AffiliateStatusBadge status={affiliate.status} />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
        <span className="text-fog">
          {summary.clicks} cliques · {totals.sales} {totals.sales === 1 ? "venda" : "vendas"} · {conversionLabel(summary.conversion)}
        </span>
        <span className="text-right">
          <span className="block font-semibold text-white tabular-nums">{formatBRL(totals.balance)}</span>
          <span className="block text-xs text-mist">liberado</span>
        </span>
      </div>
    </li>
  );
}

interface AffiliatesTabProps {
  board: AffiliatesBoard;
  onReload: () => void;
  onOpenProgram: () => void;
}

export function AffiliatesTab({ board, onReload, onOpenProgram }: AffiliatesTabProps) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const pending = board.summaries.filter((summary) => summary.affiliate.status === "pending");
  const visible = useMemo(
    () => board.summaries.filter((summary) => (status === "all" || summary.affiliate.status === status) && matches(summary, query)),
    [board.summaries, status, query],
  );
  const approved = board.summaries.filter((summary) => summary.affiliate.status === "approved").length;

  return (
    <div className="space-y-6">
      {!board.program.enabled && (
        <div className="flex flex-col gap-3 rounded-2xl border border-line-strong bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-fog">
            <strong className="text-white">Programa desligado.</strong> Ninguém consegue se cadastrar e os links não contam venda.
          </p>
          <Button variant="secondary" onClick={onOpenProgram}>
            <Power aria-hidden className="size-4" /> Ligar o programa
          </Button>
        </div>
      )}

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi label="Afiliados aprovados" value={String(approved)} />
        <Kpi label="Esperando aprovação" value={String(pending.length)} />
        <Kpi label="Vendas de afiliados" value={String(board.totals.sales)} hint="Pagas, sem as canceladas" />
        <Kpi label="Comissão pendente" value={formatBRL(board.totals.pending)} hint="Garantia ainda correndo" />
        <Kpi label="Comissão liberada" value={formatBRL(board.totals.balance)} hint="Pronta para pagar" />
      </dl>

      {pending.length > 0 && <PendingApprovals pending={pending} onDone={onReload} />}

      <AffiliateInvitesSection texts={board.program.texts} />

      {board.summaries.length === 0 ? (
        <EmptyState
          title="Nenhum afiliado ainda"
          description="Quando alguém se cadastrar em jotadigitais.com.br/seja-afiliado, aparece aqui para você aprovar. Para cadastrar alguém com comissão combinada, use Novo afiliado."
        />
      ) : (
        <>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex-1">
              <SearchInput label="Buscar afiliado" placeholder="Buscar por nome, e-mail, código ou WhatsApp" value={query} onChange={setQuery} />
            </div>
            <Button variant="secondary" onClick={() => exportCommissions(board)} disabled={board.commissions.length === 0}>
              <Download aria-hidden className="size-4" /> Exportar comissões
            </Button>
          </div>
          <FilterChips label="Situação" value={status} options={STATUS_FILTERS} onChange={setStatus} />
          {visible.length === 0 ? (
            <EmptyState title="Ninguém encontrado" description="Confira a busca ou troque a situação." />
          ) : (
            <>
              <div className="hidden overflow-hidden rounded-3xl border border-line lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="bg-surface text-xs text-mist">
                    <tr>
                      <th scope="col" className="py-3 pr-4 pl-5 font-medium">Afiliado</th>
                      <th scope="col" className="px-4 py-3 font-medium">Situação</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Cliques</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Vendas</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Conversão</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Pendente</th>
                      <th scope="col" className="px-4 py-3 text-right font-medium">Liberado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {visible.map((summary) => (
                      <AffiliateRow key={summary.affiliate.id} summary={summary} />
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="grid gap-2.5 lg:hidden">
                {visible.map((summary) => (
                  <AffiliateCard key={summary.affiliate.id} summary={summary} />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
