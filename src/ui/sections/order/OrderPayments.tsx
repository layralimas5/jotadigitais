import { Check, Copy, CreditCard, QrCode } from "lucide-react";
import qrcode from "qrcode-generator";
import { useMemo, useState } from "react";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import { paymentPartLabel, type OrderPayment } from "@/domain/payment";
import { buildPixCode } from "@/domain/pix";
import { acceptsPix } from "@/domain/store-settings";
import { Button } from "@/ui/components/Button";
import { useCardCheckout } from "@/ui/hooks/useCardCheckout";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { cn } from "@/ui/lib/cn";

const STATUS_LABEL: Record<OrderPayment["status"], string> = { pending: "Aguardando", paid: "Pago", canceled: "Cancelado" };

const STATUS_TONE: Record<OrderPayment["status"], string> = {
  pending: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  paid: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  canceled: "border-white/15 bg-white/[0.05] text-mist",
};

function qrImageOf(code: string): string {
  const qr = qrcode(0, "M");
  qr.addData(code);
  qr.make();
  return qr.createDataURL(6, 2);
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.error("Não foi possível copiar o código Pix", error);
    }
  };
  return (
    <Button type="button" variant="secondary" onClick={() => void copy()} className="w-full sm:w-auto">
      {copied ? <Check aria-hidden className="size-4" /> : <Copy aria-hidden className="size-4" />}
      <span aria-live="polite">{copied ? "Código copiado" : "Copiar código Pix"}</span>
    </Button>
  );
}

function PixPayment({ order, payment }: { order: Order; payment: OrderPayment }) {
  const settings = useStoreSettings();
  const code = useMemo(
    () =>
      acceptsPix(settings)
        ? buildPixCode({
            key: settings.pixKey ?? "",
            receiverName: settings.pixReceiverName ?? "",
            receiverCity: settings.pixReceiverCity ?? "",
            amount: payment.amount,
            txid: order.code,
          })
        : null,
    [settings, payment.amount, order.code],
  );

  if (!code) {
    return <p className="text-sm text-mist">O Pix ainda não está disponível. Fale com o suporte para receber a chave.</p>;
  }
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
      <img
        src={qrImageOf(code)}
        alt={`QR Code Pix de ${formatBRL(payment.amount)} para o pedido ${order.code}`}
        className="size-44 shrink-0 rounded-xl bg-white p-2"
      />
      <div className="w-full min-w-0 space-y-3 text-left">
        <p className="text-sm text-fog">
          Abra o app do seu banco, escolha Pix e leia o QR Code ou cole o código. O valor já vem preenchido.
        </p>
        <p className="rounded-xl border border-line bg-ink/60 p-3 font-mono text-[0.7rem] break-all text-mist select-all">{code}</p>
        <CopyButton value={code} />
        <p className="text-xs text-mist">
          Assim que o Pix cair, o Jota confirma e esta página atualiza sozinha. Recebedor: {settings.pixReceiverName}.
        </p>
      </div>
    </div>
  );
}

const installmentsLabel = (count: number) => (count === 1 ? "pagamento à vista (1x)" : `${count}x`);

function CardPayment({ order, payment }: { order: Order; payment: OrderPayment }) {
  const checkout = useCardCheckout();
  return (
    <div className="space-y-3 text-left">
      <p className="text-sm text-fog">
        {payment.requestedInstallments
          ? `Você vai para o checkout seguro da InfinitePay. Lá, escolha ${installmentsLabel(payment.requestedInstallments)}, como no pedido, e volte para cá depois de pagar.`
          : "Você vai para o checkout seguro da InfinitePay, escolhe as parcelas (até 12x) e volta para cá depois de pagar."}
      </p>
      <Button
        type="button"
        className="w-full sm:w-auto"
        disabled={checkout.pending}
        onClick={() => void checkout.open(order.code, payment.id)}
      >
        <CreditCard aria-hidden className="size-4" />
        {checkout.pending ? "Abrindo o pagamento…" : `Pagar ${formatBRL(payment.amount)} no cartão`}
      </Button>
      {checkout.error && (
        <p role="alert" className="text-sm text-[#ff7a7a]">
          {checkout.error}
        </p>
      )}
    </div>
  );
}

function PaymentPart({ order, payment }: { order: Order; payment: OrderPayment }) {
  const canPay = order.status === "awaiting_payment" && payment.status === "pending";
  const Icon = payment.method === "pix" ? QrCode : CreditCard;
  return (
    <li className="rounded-2xl border border-line bg-surface/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 font-semibold text-white">
          <Icon aria-hidden className="size-4 text-electric" />
          {paymentPartLabel(payment, order.payments)}
          <span className="text-mist tabular-nums">· {formatBRL(payment.amount)}</span>
        </p>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", STATUS_TONE[payment.status])}>
          {STATUS_LABEL[payment.status]}
        </span>
      </div>
      {canPay && (
        <div className="mt-4 border-t border-line pt-4">
          {payment.method === "pix" ? <PixPayment order={order} payment={payment} /> : <CardPayment order={order} payment={payment} />}
        </div>
      )}
    </li>
  );
}

/** Cobranças do pedido: cada parte com o jeito de pagar e a situação. */
export function OrderPayments({ order }: { order: Order }) {
  if (order.payments.length === 0) return null;
  const pending = order.payments.filter((payment) => payment.status === "pending").length;
  return (
    <section aria-labelledby="pagamento-title" className="mx-auto mt-10 max-w-xl text-left">
      <h2 id="pagamento-title" className="font-display text-lg font-semibold text-white">
        {order.status === "awaiting_payment" && pending > 0 ? "Pague para liberar a conta" : "Pagamento"}
      </h2>
      {order.payments.length > 1 && order.status === "awaiting_payment" && (
        <p className="mt-1 text-sm text-mist">Seu pagamento foi dividido em duas partes. Pague as duas, na ordem que preferir.</p>
      )}
      <ul className="mt-4 space-y-3">
        {order.payments.map((payment) => (
          <PaymentPart key={payment.id} order={order} payment={payment} />
        ))}
      </ul>
    </section>
  );
}
