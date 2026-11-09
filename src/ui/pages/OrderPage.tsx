import { motion, useReducedMotion } from "framer-motion";
import { Clock, Inbox, Sparkles } from "lucide-react";
import { Fragment, useEffect, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { OrderNotFoundError } from "@/domain/errors";
import { formatBRL } from "@/domain/money";
import type { Order } from "@/domain/order";
import { PAYMENT_PLAN_LABEL } from "@/domain/payment";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { VerifiedBadge } from "@/ui/components/VerifiedBadge";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useSiteContent } from "@/ui/hooks/useSiteContent";
import { useCardReturn } from "@/ui/hooks/useCardCheckout";
import { useOrder } from "@/ui/hooks/useStore";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { EASE_OUT_EXPO } from "@/ui/lib/motion";
import { editable, IS_SITE_PREVIEW, PREVIEW_ORDER_CODE } from "@/ui/lib/site-preview";
import { OrderPayments } from "@/ui/sections/order/OrderPayments";

/** Pedido fictício da prévia da aba Site: mostra a página já paga, sem tocar no banco. */
const PREVIEW_ORDER: Order = {
  code: PREVIEW_ORDER_CODE,
  accountId: "preview",
  accountHandle: "@suaconta",
  accountName: "Sua conta",
  accountPlatform: "tiktok",
  customer: {
    name: "Cliente Exemplo",
    email: null,
    whatsapp: null,
    document: null,
    birthDate: null,
    instagram: null,
    city: null,
    state: null,
    source: null,
    referredBy: null,
  },
  paymentMethod: "pix",
  total: 50_000,
  couponCode: null,
  discount: 0,
  status: "paid",
  expiresAt: new Date(0).toISOString(),
  createdAt: new Date(0).toISOString(),
  deliveredAt: null,
  payments: [],
};

/** Troca {nome} e {conta} na página do pedido. */
const fillOrderTokens = (text: string, order: Order) =>
  text.replaceAll("{nome}", order.customer.name.split(" ")[0] ?? "").replaceAll("{conta}", order.accountHandle);

/** A frase abaixo do título destaca o @ da conta onde estiver {conta}. */
function ReservedLine({ text, order }: { text: string; order: Order }) {
  const parts = text.replaceAll("{nome}", order.customer.name.split(" ")[0] ?? "").split("{conta}");
  return (
    <p {...editable("orderPage.reserved")} className="mx-auto mt-4 max-w-md text-mist">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <span className="font-semibold text-white">{order.accountHandle}</span>}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

/** Enquanto espera pagamento, a página confere de novo sozinha (pega também o Pix confirmado pelo Jota no painel). */
const REFRESH_MS = 20_000;

function NextSteps({ order }: { order: Order }) {
  const { orderPage } = useSiteContent();
  const steps = [
    {
      icon: Clock,
      title: orderPage.paymentStepTitle,
      titlePath: "orderPage.paymentStepTitle",
      text: orderPage.paymentStepText[order.paymentMethod],
      textPath: `orderPage.paymentStepText.${order.paymentMethod}`,
    },
    ...orderPage.steps.map((step, index) => ({
      icon: index === 0 ? Inbox : Sparkles,
      title: step.title,
      titlePath: `orderPage.steps.${index}.title`,
      text: step.text,
      textPath: `orderPage.steps.${index}.text`,
    })),
  ];
  return (
    <ol className="mt-10 grid gap-3 text-left sm:grid-cols-3">
      {steps.map(({ icon: Icon, title, titlePath, text, textPath }) => (
        <li key={titlePath} className="hover-pulse flex gap-3 rounded-2xl border border-line bg-surface/70 p-4 sm:flex-col sm:gap-2">
          <span className="pulse-icon inline-grid size-8 shrink-0 place-items-center rounded-lg border border-white/10 bg-ink text-electric">
            <Icon aria-hidden className="size-4" />
          </span>
          <div>
            <p {...editable(titlePath)} className="text-sm font-semibold text-white">
              {fillOrderTokens(title, order)}
            </p>
            <p {...editable(textPath)} className="mt-1 text-xs leading-snug text-mist">
              {fillOrderTokens(text, order)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function OrderConfirmation({ order, onPaid }: { order: Order; onPaid: () => void }) {
  const reduceMotion = useReducedMotion();
  const { whatsappUrl } = useStoreSettings();
  const { orderPage } = useSiteContent();
  useDocumentMeta(`Pedido ${order.code}`);
  const awaiting = order.status === "awaiting_payment";

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
      <h1
        id="pedido-title"
        {...editable(awaiting ? "orderPage.titleAwaiting" : "orderPage.titlePaid")}
        className="mt-8 font-display text-3xl font-semibold tracking-tight text-balance text-white md:text-5xl"
      >
        {fillOrderTokens(awaiting ? orderPage.titleAwaiting : orderPage.titlePaid, order)}
      </h1>
      <ReservedLine text={orderPage.reserved} order={order} />

      <dl className="mx-auto mt-8 grid max-w-md grid-cols-3 divide-x divide-line rounded-2xl border border-line bg-surface/60 text-sm">
        <div className="p-4">
          <dt className="text-xs text-mist">Pedido</dt>
          <dd className="mt-1 font-mono font-semibold text-white">{order.code}</dd>
        </div>
        <div className="p-4">
          <dt className="text-xs text-mist">Total</dt>
          <dd className="mt-1 font-semibold text-white tabular-nums">{formatBRL(order.total)}</dd>
          {order.couponCode && order.discount > 0 && (
            <dd className="mt-0.5 text-xs text-emerald-300">
              Cupom {order.couponCode}: −{formatBRL(order.discount)}
            </dd>
          )}
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
  if (IS_SITE_PREVIEW && code === PREVIEW_ORDER_CODE) return <OrderPreview />;
  return <LiveOrderPage code={code} />;
}

function OrderShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative overflow-hidden pt-28 pb-24 md:pt-36">
      <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 h-96 w-[48rem] -translate-x-1/2 rounded-full bg-violet/25 blur-[140px]" />
      <div className="relative mx-auto max-w-3xl px-4 sm:px-6">{children}</div>
    </div>
  );
}

function OrderPreview() {
  return (
    <OrderShell>
      <OrderConfirmation order={PREVIEW_ORDER} onPaid={() => undefined} />
    </OrderShell>
  );
}

function LiveOrderPage({ code }: { code: string }) {
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
    <OrderShell>
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
    </OrderShell>
  );
}
