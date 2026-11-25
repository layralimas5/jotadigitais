import { CalendarClock, CheckCircle2, Gift, PackageCheck } from "lucide-react";
import { useState } from "react";
import { claimAffiliateGift, loadAffiliateGifts, type AffiliateGiftView } from "@/application/affiliate-use-cases";
import { GIFT_STATE_LABEL } from "@/domain/affiliate-rewards";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useAsync } from "@/ui/hooks/useAsync";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { cn } from "@/ui/lib/cn";
import { AffiliateSpinner } from "../AffiliateLayout";
import { useAffiliateMe, useAffiliatePortal } from "../session";

const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

function GiftCard({ view, onClaim }: { view: AffiliateGiftView; onClaim: (giftId: string) => Promise<void> }) {
  const { gift, state } = view;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const claim = async () => {
    setBusy(true);
    setError(null);
    try {
      await onClaim(gift.id);
    } catch (claimError) {
      console.error(claimError);
      setError(claimError instanceof Error ? claimError.message : "Não deu para receber agora. Tente de novo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={cn(
        "flex flex-col gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center",
        state === "available" ? "border-electric/40 bg-electric/[0.06]" : "border-line bg-surface/60",
      )}
    >
      <span
        aria-hidden
        className={cn("grid size-12 shrink-0 place-items-center rounded-2xl", state === "available" ? "bg-electric/20 text-electric" : "bg-white/[0.06] text-mist")}
      >
        {state === "delivered" ? <PackageCheck className="size-6" /> : <Gift className="size-6" />}
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-white">{gift.title}</h2>
        {gift.description && <p className="mt-1 text-sm whitespace-pre-line text-fog">{gift.description}</p>}
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mist">
          <span>{GIFT_STATE_LABEL[state]}</span>
          {gift.expiresAt && state === "available" && (
            <span className="inline-flex items-center gap-1">
              <CalendarClock aria-hidden className="size-3.5" /> Receba até {dateTime.format(new Date(gift.expiresAt))}
            </span>
          )}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-sm text-alert">
            {error}
          </p>
        )}
      </div>
      {state === "available" ? (
        <Button onClick={() => void claim()} disabled={busy} className="shrink-0">
          {busy ? "Recebendo..." : "Receber"}
        </Button>
      ) : (
        state !== "expired" && (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-sm text-fog">
            <CheckCircle2 aria-hidden className="size-4 text-electric" /> {state === "delivered" ? "Entregue" : "Pedido"}
          </span>
        )
      )}
    </li>
  );
}

/** Brindes que o Jota oferece: um toque em "Receber" e a loja é avisada para entregar. */
export default function AffiliateGiftsPage() {
  useDocumentMeta("Brindes do afiliado");
  const me = useAffiliateMe();
  const portal = useAffiliatePortal();
  const gifts = useAsync(() => loadAffiliateGifts(portal), `affiliate-gifts:${me.id}`, { keepPrevious: true });

  if (gifts.status === "loading") return <AffiliateSpinner />;
  if (gifts.status === "error") return <ErrorState message={gifts.error.message} onRetry={gifts.retry} />;

  const claim = async (giftId: string) => {
    await claimAffiliateGift(portal, giftId);
    gifts.retry();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Brindes</h1>
        <p className="mt-1 text-sm text-fog">Presentes da loja para quem divulga. Toque em Receber e o Jota entrega para você.</p>
      </div>
      {gifts.data.length === 0 ? (
        <EmptyState title="Nenhum brinde por enquanto" description="Quando a loja liberar um brinde, ele aparece aqui e no sininho do painel." />
      ) : (
        <ul className="space-y-3">
          {gifts.data.map((view) => (
            <GiftCard key={view.gift.id} view={view} onClaim={claim} />
          ))}
        </ul>
      )}
    </div>
  );
}
