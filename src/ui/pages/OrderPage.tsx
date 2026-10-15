import { motion, useReducedMotion } from "framer-motion";
import { Clock, Inbox, Sparkles } from "lucide-react";
import { useParams } from "react-router-dom";
import { OrderNotFoundError } from "@/domain/errors";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useOrder } from "@/ui/hooks/useStore";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";

const PAYMENT_LABEL: Record<Order["paymentMethod"], string> = { pix: "Pix", card: "Cartão de crédito" };

function NextSteps({ order }: { order: Order }) {
  const steps = [
    {
      icon: Clock,
      title: "Confirmação do pagamento",
      text: order.paymentMethod === "pix" ? "No Pix, a confirmação sai em instantes." : "No cartão, a operadora confirma em poucos minutos.",
    },
    {
      icon: Inbox,
      title: "Acesso no seu e-mail",
      text: `Login, senha e o passo a passo vão para ${order.customer.email}. Confira também o spam.`,
    },
    {
      icon: Sparkles,
      title: "Deixe a conta com a sua cara",
      text: "Troque nome, @ e foto e afilie seus primeiros produtos na vitrine.",
    },
  ];
  return (
    <ol className="mt-10 space-y-4 text-left">
      {steps.map(({ icon: Icon, title, text }) => (
        <li key={title} className="flex gap-4 rounded-2xl border border-line bg-surface/70 p-5">
          <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
          <div>
            <p className="font-semibold text-white">{title}</p>
            <p className="mt-1 text-sm text-mist">{text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OrderConfirmation({ order }: { order: Order }) {
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
        Pedido recebido, {firstName}!
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
          <dd className="mt-1 font-semibold text-white">{PAYMENT_LABEL[order.paymentMethod]}</dd>
        </div>
      </dl>

      <div className="mx-auto max-w-md">
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

  return (
    <div className="relative overflow-hidden pt-28 pb-24 md:pt-36">
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-violet/25 blur-[140px]" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">
        {order.status === "loading" && (
          <div className="grid min-h-[40vh] place-items-center" role="status" aria-label="Carregando pedido">
            <span className="size-8 animate-spin rounded-full border-2 border-white/15 border-t-electric" />
          </div>
        )}
        {order.status === "error" &&
          (order.error instanceof OrderNotFoundError ? (
            <EmptyState
              title="Pedido não encontrado"
              description="Confira o código do pedido no e-mail de confirmação."
              action={<ButtonLink to="/">Ir para o início</ButtonLink>}
            />
          ) : (
            <ErrorState message={order.error.message} onRetry={order.retry} />
          ))}
        {order.status === "success" && <OrderConfirmation order={order.data} />}
      </div>
    </div>
  );
}
