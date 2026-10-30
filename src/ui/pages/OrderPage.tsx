import { motion, useReducedMotion } from "framer-motion";
import { Clock, Inbox, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { useParams } from "react-router-dom";
import { OrderNotFoundError } from "@/domain/errors";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import { PAYMENT_PLAN_LABEL, type PaymentPlan } from "@/domain/payment";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useCardReturn } from "@/ui/hooks/useCardCheckout";
import { useOrder } from "@/ui/hooks/useStore";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { OrderPayments } from "@/ui/sections/order/OrderPayments";

const CONFIRMATION_TEXT: Record<PaymentPlan, string> = {
  pix: "O Pix é confirmado assim que cai na conta.",
  card: "No cartão, a confirmação é automática assim que a InfinitePay aprova.",
  two_cards: "Cada cartão é confirmado automaticamente assim que é aprovado.",
  card_pix: "O cartão é confirmado na hora; o Pix, assim que cai na conta.",
};

/** Enquanto espera pagamento, a página confere de novo sozinha (pega também o Pix confirmado pelo Jota no painel). */
const REFRESH_MS = 20_000;

function NextSteps({ order }: { order: Order }) {
  const steps = [
    {
      icon: Clock,
      title: "Confirmação do pagamento",
      text: CONFIRMATION_TEXT[order.paymentMethod],
    },
    {
      icon: Inbox,
      title: "Acesso no seu WhatsApp",
      text: "Login, senha e o passo a passo chegam no WhatsApp que você informou na compra.",
    },
    {
      icon: Sparkles,
      title: "Deixe a conta com a sua cara",
      text: "Troque nome, @ e foto e afilie seus primeiros produtos na vitrine.",
    },
  ];
  return (
    <ol className="mt-10 grid gap-3 text-left sm:grid-cols-3">
      {steps.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-3 rounded-2xl border border-line bg-surface/70 p-4 sm:flex-col sm:gap-2">
          <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-electric sm:mt-0" />
          <div>
            <p className="text-sm font-semibold text-white">{title}</p>
            <p className="mt-1 text-xs leading-snug text-mist">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OrderConfirmation({ order, onPaid }: { order: Order; onPaid: () => void }) {
  const reduceMotion = useReducedMotion();
  const { whatsappUrl } = useStoreSettings();
  useDocumentMeta(`Pedido ${order.code}`);
  const firstName = order.customer.name.split(" ")[0];

  return (
    <div className="text-center">
      <motion.div
        initial={reduceMotion ? false : { scale: 0.6, opacity: 0, rotate: -20 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ duration: 0.8, ease: EASE_OUT_EXPO }}
        className="mx-auto w-fit"
      >
        <VerifiedBadge className="size-20 drop-shadow-[0_0_40px_rgb(39_153_255/0.6)]" />
      </motion.div>
      <h1 className="mt-8 font-display text-3xl font-semibold tracking-tight text-balance text-white md:text-5xl">
        {order.status === "awaiting_payment" ? `Pedido recebido, ${firstName}!` : `Pagamento confirmado, ${firstName}!`}
      </h1>
      <p className="mx-auto mt-4 max-w-md text-mist">
        A conta <span className="font-semibold text-white">{order.accountHandle}</span> está reservada para você.
      </p>

      <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/60 text-sm">
        <div className="p-4">
          <dt className="text-xs text-mist">Pedido</dt>
          <dd className="mt-1 font-mono font-semibold text-white">{order.code}</dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-mist">Total</dt>
          <dd className="mt-1 font-semibold text-white tabular-nums">{formatBRL(order.total)}</dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-mist">Pagamento</dt>
          <dd className="mt-1 font-semibold text-white">{PAYMENT_PLAN_LABEL[order.paymentMethod]}</dd>
        </div>
      </dl>

      <OrderPayments order={order} onPaid={onPaid} />

      <div className="mx-auto max-w-3xl">
        <NextSteps order={order} />
      </div>

      <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <ButtonLink to="/contas" variant="secondary">
          Voltar para a vitrine
        </ButtonLink>
        {whatsappUrl && (
          <a
            href={`${whatsappUrl}?text=${encodeURIComponent(`Olá! Meu pedido é o ${order.code}.`)}`}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-electric-soft underline-offset-4 hover:underline"
          >
            Falar com o suporte
          </a>
        )}
      </div>
    </div>
  );
}

export default function OrderPage() {
  const { code = "" } = useParams();
  const order = useOrder(code);
  const { retry } = order;
  const { checking } = useCardReturn(retry);
  const awaitingPayment = order.status === "success" && order.data.status === "awaiting_payment";

  useEffect(() => {
    if (!awaitingPayment) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") retry();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [awaitingPayment, retry]);

  return (
    <div className="relative overflow-hidden pt-28 pb-24 md:pt-36">
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-violet/25 blur-[140px]" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        {checking && (
          <p role="status" className="mb-6 rounded-2xl border border-line bg-surface/70 p-4 text-center text-sm text-fog">
            Conferindo o pagamento no cartão…
          </p>
        )}
        {order.status === "loading" && (
          <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Carregando pedido">
            <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-electric" />
          </div>
        )}
        {order.status === "error" &&
          (order.error instanceof OrderNotFoundError ? (
            <EmptyState
              title="Pedido não encontrado"
              description="Confira o código do pedido na mensagem que você recebeu no WhatsApp."
              action={<ButtonLink to="/">Ir para o início</ButtonLink>}
            />
          ) : (
            <ErrorState message={order.error.message} onRetry={order.retry} />
          ))}
        {order.status === "success" && <OrderConfirmation order={order.data} onPaid={retry} />}
      </div>
    </div>
  );
}
