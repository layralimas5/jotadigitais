import { CheckCircle2, Undo2, Wallet } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import { payAffiliateBatch, undoAffiliatePayout, type AffiliateSummary, type AffiliatesBoard } from "@/application/affiliate-use-cases";
import type { AffiliateCommission } from "@/domain/affiliate";
import type { AffiliatePayout } from "@/domain/affiliate-rewards";
import { formatBRL } from "@/domain/money";
import { CopyButton } from "@/ui/affiliate/components/AffiliateUi";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { TextAreaField } from "../components/FormControls";
import { Kpi } from "../components/Kpi";
import { Modal } from "../components/Modal";
import { PersonAvatar } from "../components/PersonAvatar";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";
import { affiliatePath } from "./AffiliatesTab";

const paidDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" });

export interface PayRequest {
  summary: AffiliateSummary;
  commissions: AffiliateCommission[];
}

/** Confirma o "Paguei": mostra a chave Pix, o valor e quantas ainda estão na garantia. */
export function PayDialog({ request, onClose, onPaid }: { request: PayRequest | null; onClose: () => void; onPaid: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const pay = useMutation(payAffiliateBatch);
  const amount = request?.commissions.reduce((total, commission) => total + commission.amount, 0) ?? 0;
  const inGuarantee = request?.commissions.filter((commission) => commission.releaseAt === null || new Date(commission.releaseAt) > new Date()).length ?? 0;

  const confirm = async () => {
    if (!request) return;
    const paid = await pay.run(
      request.summary.affiliate.id,
      request.commissions.map((commission) => commission.id),
      note,
    );
    if (!paid) return;
    toast.show(`Pagamento de ${formatBRL(amount)} registrado para ${request.summary.affiliate.name}.`);
    setNote("");
    onPaid();
  };

  return (
    <Modal open={request !== null} title="Registrar pagamento" onClose={onClose} placement="center">
      {request && (
        <div className="space-y-4 text-sm">
          <p className="text-fog">
            Faça o Pix para <strong className="text-white">{request.summary.affiliate.name}</strong> e depois confirme aqui. As{" "}
            {request.commissions.length} indicações entram como pagas no painel dele.
          </p>
          <div className="rounded-2xl border border-line bg-ink/60 p-4">
            <p className="text-xs text-mist">Valor</p>
            <p className="font-display text-2xl font-bold text-white tabular-nums">{formatBRL(amount)}</p>
            <p className="mt-3 text-xs text-mist">Chave Pix</p>
            {request.summary.affiliate.pixKey ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono text-white">{request.summary.affiliate.pixKey}</span>
                <CopyButton text={request.summary.affiliate.pixKey} label="Copiar chave" />
              </div>
            ) : (
              <p className="mt-1 text-alert">Ele ainda não cadastrou a chave Pix no perfil. Peça antes de pagar.</p>
            )}
          </div>
          {inGuarantee > 0 && (
            <p className="rounded-xl border border-electric/35 bg-electric/[0.07] px-4 py-3 text-fog">
              {inGuarantee === 1 ? "Uma dessas indicações ainda está" : `${inGuarantee} dessas indicações ainda estão`} na garantia. Se o cliente
              pedir reembolso, a comissão já terá sido paga.
            </p>
          )}
          <TextAreaField
            label="Anotação (opcional)"
            name="payoutNote"
            rows={2}
            maxLength={500}
            placeholder="Ex.: Pix feito pelo C6 às 14h"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
          {pay.error && <InlineError message={pay.error.message} />}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button onClick={() => void confirm()} disabled={pay.pending}>
              <CheckCircle2 aria-hidden className="size-4" /> {pay.pending ? "Registrando..." : "Paguei"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Um afiliado: barra até o próximo lote e os botões de pagamento. Usado na aba e na ficha do afiliado. */
export function AffiliatePayoutCard({ summary, onPay, showName = true }: { summary: AffiliateSummary; onPay: (request: PayRequest) => void; showName?: boolean }) {
  const { payout, affiliate } = summary;
  const labelId = useId();
  const ready = payout.readyBatches > 0;
  const percent = Math.round((ready ? 1 : payout.inCurrentBatch / payout.batchSize) * 100);
  return (
    <li className={cn("rounded-3xl border p-4 sm:p-5", ready ? "border-electric/45 bg-electric/[0.06]" : "border-line bg-surface/60")}>
      {showName && (
        <div className="flex items-center gap-3">
          <PersonAvatar name={affiliate.name} />
          <div className="min-w-0 flex-1">
            <Link to={affiliatePath(affiliate.id)} className="block truncate font-semibold text-white hover:underline">
              {affiliate.name}
            </Link>
            <p className="truncate text-xs text-mist">Pix: {affiliate.pixKey ?? "não cadastrado"}</p>
          </div>
          {ready && <span className="shrink-0 rounded-full bg-electric px-2.5 py-1 text-xs font-semibold text-white">Pronto para pagar</span>}
        </div>
      )}
      <div className={cn(showName && "mt-4")}>
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span id={labelId} className="text-fog">
            {ready
              ? `${payout.readyBatches === 1 ? "1 lote completo" : `${payout.readyBatches} lotes completos`} (${payout.waiting.length} indicações)`
              : `${payout.inCurrentBatch} de ${payout.batchSize} indicações, faltam ${payout.missingForNextBatch}`}
          </span>
          <span className="shrink-0 text-mist tabular-nums">{formatBRL(payout.waitingAmount)} esperando</span>
        </div>
        <div role="progressbar" aria-labelledby={labelId} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="h-full rounded-full bg-electric" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-mist">
          Já pagas: {payout.paidCount} {payout.paidCount === 1 ? "indicação" : "indicações"} ({formatBRL(payout.paidAmount)})
        </p>
      </div>
      {payout.waiting.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {ready && (
            <Button onClick={() => onPay({ summary, commissions: payout.nextBatch })}>
              <Wallet aria-hidden className="size-4" /> Pagar lote de {payout.nextBatch.length} ({formatBRL(payout.nextBatchAmount)})
            </Button>
          )}
          <Button variant={ready ? "ghost" : "secondary"} onClick={() => onPay({ summary, commissions: payout.waiting })}>
            Pagar todas as {payout.waiting.length} ({formatBRL(payout.waitingAmount)})
          </Button>
        </div>
      )}
    </li>
  );
}

function PayoutHistory({ payouts, names, onUndone }: { payouts: AffiliatePayout[]; names: ReadonlyMap<string, string>; onUndone: () => void }) {
  const toast = useToast();
  const [undoing, setUndoing] = useState<AffiliatePayout | null>(null);
  const undo = useMutation(async (deps, payoutId: string) => {
    await undoAffiliatePayout(deps, payoutId);
    return true;
  });

  const confirmUndo = async () => {
    if (!undoing) return;
    const done = await undo.run(undoing.id);
    if (!done) {
      toast.show("Não deu para desfazer agora. Tente de novo.", "error");
      return;
    }
    toast.show("Pagamento desfeito. As indicações voltaram a esperar pagamento.");
    setUndoing(null);
    onUndone();
  };

  if (payouts.length === 0) return null;
  return (
    <section aria-labelledby="historico-pagamentos" className="space-y-3">
      <h2 id="historico-pagamentos" className="font-display text-lg font-semibold text-white">
        Pagamentos feitos
      </h2>
      <ul className="divide-y divide-line rounded-3xl border border-line bg-surface/50">
        {payouts.map((payout) => (
          <li key={payout.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-sm sm:px-5">
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-white">{names.get(payout.affiliateId) ?? "Afiliado removido"}</span>
              <span className="block text-xs text-mist">
                {paidDay.format(new Date(payout.paidAt))} · {payout.commissionsCount} {payout.commissionsCount === 1 ? "indicação" : "indicações"}
                {payout.note ? ` · ${payout.note}` : ""}
              </span>
            </span>
            <span className="font-display font-bold text-white tabular-nums">{formatBRL(payout.amount)}</span>
            <Button variant="ghost" onClick={() => setUndoing(payout)} aria-label={`Desfazer pagamento de ${formatBRL(payout.amount)}`}>
              <Undo2 aria-hidden className="size-4" />
            </Button>
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={undoing !== null}
        title="Desfazer este pagamento?"
        description="Use só se marcou por engano. As indicações voltam a aparecer como esperando pagamento, para você e para o afiliado."
        confirmLabel="Desfazer"
        pending={undo.pending}
        onConfirm={() => void confirmUndo()}
        onClose={() => setUndoing(null)}
      />
    </section>
  );
}

/** Aba Pagamentos: quem já fechou lote, quanto falta para cada um e o histórico do que foi pago. */
export function AffiliatePayoutsTab({ board, onReload }: { board: AffiliatesBoard; onReload: () => void }) {
  const payouts = useAdminQuery((deps) => deps.affiliates.listPayouts(), "admin-affiliate-payouts");
  const [request, setRequest] = useState<PayRequest | null>(null);
  const approved = board.summaries
    .filter((summary) => summary.affiliate.status === "approved" || summary.payout.waiting.length > 0)
    .sort((a, b) => b.payout.readyBatches - a.payout.readyBatches || b.payout.waiting.length - a.payout.waiting.length);
  const readyCount = approved.filter((summary) => summary.payout.readyBatches > 0).length;
  const waitingAmount = approved.reduce((total, summary) => total + summary.payout.waitingAmount, 0);
  const paidAmount = approved.reduce((total, summary) => total + summary.payout.paidAmount, 0);
  const names = new Map(board.summaries.map((summary) => [summary.affiliate.id, summary.affiliate.name]));

  const reloadAll = () => {
    setRequest(null);
    onReload();
    payouts.reload();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Prontos para pagar" value={String(readyCount)} hint={`Lote de ${board.program.payoutBatchSize} indicações`} />
        <Kpi label="Esperando pagamento" value={formatBRL(waitingAmount)} />
        <Kpi label="Já pago" value={formatBRL(paidAmount)} />
      </div>
      {approved.length === 0 ? (
        <EmptyState title="Nenhum afiliado aprovado ainda" description="Quando um afiliado vender, o progresso até o pagamento aparece aqui." />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {approved.map((summary) => (
            <AffiliatePayoutCard key={summary.affiliate.id} summary={summary} onPay={setRequest} />
          ))}
        </ul>
      )}
      {payouts.status === "loading" && <LoadingBlock label="Carregando pagamentos" />}
      {payouts.status === "error" && <ErrorState message={payouts.error.message} onRetry={payouts.reload} />}
      {payouts.status === "success" && <PayoutHistory payouts={payouts.data} names={names} onUndone={reloadAll} />}
      <PayDialog request={request} onClose={() => setRequest(null)} onPaid={reloadAll} />
    </div>
  );
}


