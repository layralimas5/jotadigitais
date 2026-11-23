import { Check, Copy, Gift, MessageCircle } from "lucide-react";
import { useState } from "react";
import { markReferralPayoutPaid } from "@/application/admin-use-cases";
import type { PartnerSummary } from "@/domain/partner";
import { REFERRAL_PAYOUT_POINTS } from "@/domain/referral";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { useMutation } from "../hooks";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";

const payoutMessage = (name: string) =>
  `Oi, ${firstNameOf(name)}! Você completou ${REFERRAL_PAYOUT_POINTS} pontos de indicação na Jota Digitais. Já te mando o pagamento no Pix, obrigado pelas indicações!`;

const duePoints = (summary: PartnerSummary) => summary.payoutsDue * REFERRAL_PAYOUT_POINTS;

/** "Já paguei" em dois toques: o primeiro pergunta, o segundo registra um pagamento de 10 pontos. */
function PaidButton({ summary, onPaid }: { summary: PartnerSummary; onPaid: () => void }) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const pay = useMutation((deps, id: string) => markReferralPayoutPaid(deps, id));

  const confirm = async () => {
    const paid = await pay.run(summary.partner.id);
    setConfirming(false);
    if (!paid) return;
    toast.show(`Pagamento de ${REFERRAL_PAYOUT_POINTS} pontos registrado para ${firstNameOf(summary.partner.name)}.`);
    onPaid();
  };

  const failure = pay.error && (
    <p role="alert" className="basis-full text-sm text-red-300">
      {pay.error.message}
    </p>
  );
  if (!confirming) {
    return (
      <>
        <Button size="md" onClick={() => setConfirming(true)}>
          <Check aria-hidden className="size-4" /> Já paguei
        </Button>
        {failure}
      </>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Button size="md" onClick={() => void confirm()} disabled={pay.pending}>
        {pay.pending ? "Registrando…" : `Confirmar ${REFERRAL_PAYOUT_POINTS} pontos pagos`}
      </Button>
      <Button size="md" variant="ghost" onClick={() => setConfirming(false)} disabled={pay.pending}>
        Cancelar
      </Button>
    </span>
  );
}

function CopyPixButton({ pixKey }: { pixKey: string }) {
  const toast = useToast();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(pixKey);
      toast.show("Chave Pix copiada.");
    } catch {
      toast.show(`Não deu para copiar. A chave é ${pixKey}`, "error");
    }
  };
  return (
    <Button size="md" variant="secondary" onClick={() => void copy()}>
      <Copy aria-hidden className="size-4" /> Copiar Pix
    </Button>
  );
}

/** Um parceiro com pagamento de indicação esperando: quanto pagar, Pix, aviso no WhatsApp e "Já paguei". */
export function ReferralPayoutCard({ summary, onPaid, className }: { summary: PartnerSummary; onPaid: () => void; className?: string }) {
  const { partner, payoutsDue } = summary;
  return (
    <div className={cn("rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.06] p-4", className)}>
      <p className="flex items-start gap-2 text-sm text-fog">
        <Gift aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-300" />
        <span>
          <strong className="font-semibold text-white">{partner.name}</strong> completou{" "}
          <strong className="font-semibold text-white tabular-nums">{duePoints(summary)} pontos</strong> por indicação.{" "}
          {payoutsDue > 1 ? `São ${payoutsDue} pagamentos esperando; cada "Já paguei" registra um.` : "Hora de pagar."}
          {partner.pixKey ? "" : " Ele ainda não tem chave Pix cadastrada."}
        </span>
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <PaidButton summary={summary} onPaid={onPaid} />
        {partner.pixKey && <CopyPixButton pixKey={partner.pixKey} />}
        {partner.whatsapp && (
          <a
            href={whatsappChatUrl(partner.whatsapp, payoutMessage(partner.name))}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-sm text-emerald-300 hover:bg-emerald-400/10"
          >
            <MessageCircle aria-hidden className="size-4" /> Avisar no WhatsApp
          </a>
        )}
      </div>
    </div>
  );
}

/** Topo da aba Parceiros: todo parceiro que completou 10 pontos e ainda não foi pago. */
export function ReferralPayoutAlerts({ summaries, onPaid }: { summaries: PartnerSummary[]; onPaid: () => void }) {
  const due = summaries.filter((summary) => summary.payoutsDue > 0);
  if (due.length === 0) return null;
  return (
    <section aria-labelledby="referral-payouts" className="space-y-2.5">
      <h2 id="referral-payouts" className="text-sm font-medium text-fog">
        Pagar por indicação ({due.length})
      </h2>
      {due.map((summary) => (
        <ReferralPayoutCard key={summary.partner.id} summary={summary} onPaid={onPaid} />
      ))}
    </section>
  );
}

/** Selo ao lado do nome na lista: o parceiro tem pagamento de indicação esperando. */
export function PayoutDueBadge() {
  return (
    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 text-[0.68rem] font-semibold text-emerald-300">
      Pagar
    </span>
  );
}
