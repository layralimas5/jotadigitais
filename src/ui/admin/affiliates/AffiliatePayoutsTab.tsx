import { BellRing, CheckCircle2, Hourglass, ShoppingBag, Undo2, Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { payAffiliateCommissions, undoAffiliatePayout, type AffiliateSummary, type AffiliatesBoard } from "@/application/affiliate-use-cases";
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
const requestedAt = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

const sales = (count: number) => `${count} ${count === 1 ? "venda" : "vendas"}`;

/** Confirma o "Paguei": chave Pix e valor de todas as comissões liberadas do afiliado. */
export function PayDialog({ summary, onClose, onPaid }: { summary: AffiliateSummary | null; onClose: () => void; onPaid: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const pay = useMutation(payAffiliateCommissions);
  const ready = summary?.payout.ready ?? [];
  const amount = summary?.payout.readyAmount ?? 0;

  const confirm = async () => {
    if (!summary) return;
    const paid = await pay.run(
      summary.affiliate.id,
      ready.map((commission) => commission.id),
      note,
    );
    if (!paid) return;
    toast.show(`Pagamento de ${formatBRL(amount)} registrado para ${summary.affiliate.name}.`);
    setNote("");
    onPaid();
  };

  return (
    <Modal open={summary !== null} title="Registrar pagamento" onClose={onClose} placement="center">
      {summary && (
        <div className="space-y-4 text-sm">
          <p className="text-fog">
            Faça o Pix para <strong className="text-white">{summary.affiliate.name}</strong> e depois confirme aqui. As {sales(ready.length)} liberadas
            entram como pagas no painel dele.
          </p>
          <div className="rounded-2xl border border-line bg-ink/60 p-4">
            <p className="text-xs text-mist">Valor</p>
            <p className="font-display text-2xl font-bold text-white tabular-nums">{formatBRL(amount)}</p>
            <p className="mt-3 text-xs text-mist">Chave Pix</p>
            {summary.affiliate.pixKey ? (
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className="font-mono break-all text-white">{summary.affiliate.pixKey}</span>
                <CopyButton text={summary.affiliate.pixKey} label="Copiar chave" />
              </div>
            ) : (
              <p className="mt-1 text-alert">Ele ainda não cadastrou a chave Pix no perfil. Peça antes de pagar.</p>
            )}
          </div>
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
            <Button onClick={() => void confirm()} disabled={pay.pending || ready.length === 0}>
              <CheckCircle2 aria-hidden className="size-4" /> {pay.pending ? "Registrando..." : "Paguei"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** Um afiliado: quanto está liberado para pagar, o que ainda está na garantia e o "Paguei". Na aba e na ficha. */
export function AffiliatePayoutCard({ summary, onPay, showName = true }: { summary: AffiliateSummary; onPay: (summary: AffiliateSummary) => void; showName?: boolean }) {
  const { payout, affiliate } = summary;
  const ready = payout.readyAmount > 0;
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
          {ready && <span className="shrink-0 rounded-full bg-electric px-2.5 py-1 text-xs font-semibold text-ink">Pronto para pagar</span>}
        </div>
      )}
      {payout.requestedAt && (
        <p className={cn("flex items-center gap-2 rounded-xl border border-amber-300/30 bg-amber-300/[0.08] px-3 py-2 text-sm text-amber-100", showName && "mt-4")}>
          <BellRing aria-hidden className="size-4 shrink-0" /> Pediu pagamento em {requestedAt.format(new Date(payout.requestedAt))}
        </p>
      )}
      <dl className={cn("grid grid-cols-2 gap-3 text-sm", (showName || payout.requestedAt) && "mt-4")}>
        <div className="rounded-2xl border border-line bg-ink/50 p-3">
          <dt className="text-xs text-mist">Liberado para pagar</dt>
          <dd className="mt-0.5 font-display text-lg font-bold text-white tabular-nums">{formatBRL(payout.readyAmount)}</dd>
          <dd className="text-xs text-mist">{sales(payout.ready.length)}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-ink/50 p-3">
          <dt className="flex items-center gap-1 text-xs text-mist">
            <Hourglass aria-hidden className="size-3" /> Na garantia
          </dt>
          <dd className="mt-0.5 font-display text-lg font-bold text-fog tabular-nums">{formatBRL(payout.inGuaranteeAmount)}</dd>
          <dd className="text-xs text-mist">{sales(payout.inGuarantee.length)}, libera depois</dd>
        </div>
      </dl>
      <p className="mt-3 text-xs text-mist">
        Já pagas: {sales(payout.paidCount)} ({formatBRL(payout.paidAmount)})
        {payout.reservedAmount > 0 && ` · ${formatBRL(payout.reservedAmount)} reservados num código de saldo para compra`}
      </p>
      {ready && (
        <div className="mt-4">
          <Button onClick={() => onPay(summary)} className="w-full sm:w-auto">
            <Wallet aria-hidden className="size-4" /> Pagar {formatBRL(payout.readyAmount)}
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
    toast.show("Pagamento desfeito. As comissões voltaram a esperar pagamento.");
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
                {paidDay.format(new Date(payout.paidAt))} · {sales(payout.commissionsCount)}
                {payout.note ? ` · ${payout.note}` : ""}
              </span>
            </span>
            {payout.usedInPurchase && (
              <span className="inline-flex items-center gap-1 rounded-full border border-electric/30 bg-electric/10 px-2 py-0.5 text-xs text-electric-soft">
                <ShoppingBag aria-hidden className="size-3" /> Saldo usado em compra
              </span>
            )}
            <span className="font-display font-bold text-white tabular-nums">{formatBRL(payout.amount)}</span>
            {!payout.usedInPurchase && (
              <Button variant="ghost" onClick={() => setUndoing(payout)} aria-label={`Desfazer pagamento de ${formatBRL(payout.amount)}`}>
                <Undo2 aria-hidden className="size-4" />
              </Button>
            )}
          </li>
        ))}
      </ul>
      {undo.error && <InlineError message={undo.error.message} />}
      <ConfirmDialog
        open={undoing !== null}
        title="Desfazer este pagamento?"
        description="Use só se marcou por engano. As comissões voltam a aparecer como liberadas para pagar, para você e para o afiliado."
        confirmLabel="Desfazer"
        pending={undo.pending}
        onConfirm={() => void confirmUndo()}
        onClose={() => setUndoing(null)}
      />
    </section>
  );
}

/** Quem pediu primeiro, depois quem tem mais para receber. */
function byUrgency(a: AffiliateSummary, b: AffiliateSummary): number {
  const requested = Number(b.payout.requestedAt !== null && b.payout.readyAmount > 0) - Number(a.payout.requestedAt !== null && a.payout.readyAmount > 0);
  return requested || b.payout.readyAmount - a.payout.readyAmount || b.payout.inGuaranteeAmount - a.payout.inGuaranteeAmount;
}

/** Aba Pagamentos: quem tem comissão liberada (sem esperar lote), quem pediu pagamento e o histórico. */
export function AffiliatePayoutsTab({ board, onReload }: { board: AffiliatesBoard; onReload: () => void }) {
  const payouts = useAdminQuery((deps) => deps.affiliates.listPayouts(), "admin-affiliate-payouts");
  const [paying, setPaying] = useState<AffiliateSummary | null>(null);
  const relevant = board.summaries
    .filter((summary) => summary.affiliate.status === "approved" || summary.payout.readyAmount > 0 || summary.payout.inGuarantee.length > 0)
    .sort(byUrgency);
  const ready = relevant.filter((summary) => summary.payout.readyAmount > 0);
  const waiting = relevant.filter((summary) => summary.payout.readyAmount === 0);
  const readyAmount = ready.reduce((total, summary) => total + summary.payout.readyAmount, 0);
  const inGuarantee = relevant.reduce((total, summary) => total + summary.payout.inGuaranteeAmount, 0);
  const paidAmount = relevant.reduce((total, summary) => total + summary.payout.paidAmount, 0);
  const names = new Map(board.summaries.map((summary) => [summary.affiliate.id, summary.affiliate.name]));

  const reloadAll = () => {
    setPaying(null);
    onReload();
    payouts.reload();
  };

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Liberado para pagar" value={formatBRL(readyAmount)} hint={`${ready.length} ${ready.length === 1 ? "afiliado" : "afiliados"}`} />
        <Kpi label="Na garantia" value={formatBRL(inGuarantee)} hint="Libera quando a garantia acaba" />
        <Kpi label="Já pago" value={formatBRL(paidAmount)} />
      </dl>
      {relevant.length === 0 ? (
        <EmptyState title="Nenhum afiliado aprovado ainda" description="Quando um afiliado vender, o valor para pagar aparece aqui." />
      ) : (
        <>
          <section aria-labelledby="pronto-pagar" className="space-y-3">
            <h2 id="pronto-pagar" className="font-display text-lg font-semibold text-white">
              Pronto para pagar
            </h2>
            {ready.length === 0 ? (
              <p className="rounded-2xl border border-line bg-surface/50 px-4 py-3 text-sm text-mist">
                Ninguém com comissão liberada agora. Cada venda libera quando a garantia da conta acaba.
              </p>
            ) : (
              <ul className="grid gap-3 lg:grid-cols-2">
                {ready.map((summary) => (
                  <AffiliatePayoutCard key={summary.affiliate.id} summary={summary} onPay={setPaying} />
                ))}
              </ul>
            )}
          </section>
          {waiting.length > 0 && (
            <section aria-labelledby="na-garantia" className="space-y-3">
              <h2 id="na-garantia" className="font-display text-lg font-semibold text-white">
                Ainda na garantia ou sem vendas
              </h2>
              <ul className="grid gap-3 lg:grid-cols-2">
                {waiting.map((summary) => (
                  <AffiliatePayoutCard key={summary.affiliate.id} summary={summary} onPay={setPaying} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
      {payouts.status === "loading" && <LoadingBlock label="Carregando pagamentos" />}
      {payouts.status === "error" && <ErrorState message={payouts.error.message} onRetry={payouts.reload} />}
      {payouts.status === "success" && <PayoutHistory payouts={payouts.data} names={names} onUndone={reloadAll} />}
      <PayDialog summary={paying} onClose={() => setPaying(null)} onPaid={reloadAll} />
    </div>
  );
}
