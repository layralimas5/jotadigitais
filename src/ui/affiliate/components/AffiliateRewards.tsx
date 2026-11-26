import { ArrowRight, BellRing, Gift, Hourglass, MessageCircle, Rocket, ShoppingBag, Store, TrendingUp, Users, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  cancelAffiliateBalanceCoupon,
  createAffiliateBalanceCoupon,
  requestAffiliatePayout,
  type AffiliateHome,
} from "@/application/affiliate-use-cases";
import { affiliateText, commissionRuleLabel, type CommissionRule } from "@/domain/affiliate";
import { commissionRuleSummary } from "@/domain/affiliate-commission-rules";
import {
  MIN_BALANCE_COUPON_CENTS,
  affiliateWhatsAppLink,
  canRequestPayout,
  earningExamples,
  earningSentence,
  monthlyEarning,
  topEarningAccounts,
} from "@/domain/affiliate-rewards";
import { Button } from "@/ui/components/Button";
import { formatBRL } from "@/domain/money";
import { STOCK_CATEGORY_LABEL } from "@/domain/stock";
import { cn } from "@/ui/lib/cn";
import { useAffiliatePath, useAffiliatePortal, useAffiliateSession } from "../session";
import { CopyButton, LinkBox, PanelSection } from "./AffiliateUi";

const DEFAULT_BANNER_TITLE = "Indique e ganhe em cada conta vendida";
const DEFAULT_BANNER_TEXT = "Divulgue as contas da vitrine com o seu link ou cupom. Cada venda paga gera comissão para você.";

/** A regra que vale para ele: a própria, se o Jota deu uma, ou a padrão do programa. */
export const ruleFor = (home: AffiliateHome): CommissionRule => home.me.commission ?? home.program.commission;

/** Faixa de chamada no topo do painel. O texto o Jota troca na aba Programa. */
export function AffiliateBanner({ home }: { home: AffiliateHome }) {
  const pathTo = useAffiliatePath();
  const rule = ruleFor(home);
  const [example] = earningExamples(rule, [150_000]);
  return (
    <section
      aria-labelledby="banner-afiliado"
      className="relative overflow-hidden rounded-3xl border border-electric/30 bg-gradient-to-br from-electric/20 via-surface to-ink p-5 sm:p-8"
    >
      <div aria-hidden className="pointer-events-none absolute -top-20 -right-16 size-64 rounded-full bg-electric/20 blur-3xl" />
      <div className="relative max-w-2xl">
        <p className="inline-flex items-center gap-2 rounded-full bg-electric/15 px-3 py-1 text-xs font-semibold text-electric-soft">
          <Rocket aria-hidden className="size-3.5" /> {commissionRuleLabel(rule, formatBRL)}
        </p>
        <h2 id="banner-afiliado" className="mt-3 font-display text-2xl font-bold text-balance text-white sm:text-3xl">
          {home.program.bannerTitle ?? DEFAULT_BANNER_TITLE}
        </h2>
        <p className="mt-2 text-sm whitespace-pre-line text-fog sm:text-base">{home.program.bannerText ?? DEFAULT_BANNER_TEXT}</p>
        {example && <p className="mt-3 text-sm font-semibold text-white">{earningSentence(rule, example)}.</p>}
        <Link
          to={pathTo("divulgar")}
          className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
        >
          Escolher uma conta para divulgar <ArrowRight aria-hidden className="size-4" />
        </Link>
      </div>
    </section>
  );
}

function NumberTile({ icon: Icon, label, value, hint }: { icon: typeof Store; label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-line bg-surface/70 p-4">
      <dt className="flex items-center gap-2 text-xs text-mist sm:text-sm">
        <Icon aria-hidden className="size-4 text-electric" /> {label}
      </dt>
      <dd className="mt-1 truncate font-display text-xl font-bold text-white tabular-nums sm:text-2xl">{value}</dd>
      <dd className="mt-1 truncate text-xs text-mist">{hint}</dd>
    </div>
  );
}

/** Contas disponíveis, afiliados no programa e os tipos que mais venderam no mês. */
export function StoreNumbers({ home }: { home: AffiliateHome }) {
  const { store } = home;
  const [top] = store.topSold;
  return (
    <dl className="grid gap-3 sm:grid-cols-3">
      <NumberTile icon={Store} label="Contas disponíveis" value={String(store.availableAccounts.length)} hint="Prontas para você divulgar" />
      <NumberTile icon={Users} label="Afiliados no programa" value={String(store.approvedAffiliates)} hint="Divulgando com você" />
      <NumberTile
        icon={TrendingUp}
        label="Mais vendidas (30 dias)"
        value={top ? STOCK_CATEGORY_LABEL[top.category] : "Sem vendas ainda"}
        hint={
          store.topSold.length > 0
            ? store.topSold.map((item) => `${STOCK_CATEGORY_LABEL[item.category]} (${item.sold})`).join(" · ")
            : "As primeiras vendas aparecem aqui"
        }
      />
    </dl>
  );
}

const requestedDay = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Ação do painel com estado de envio e erro explícito (na visualização pela equipe, só leitura). */
function usePanelAction(onDone: () => void) {
  const { preview } = useAffiliateSession();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (action: () => Promise<unknown>) => {
    setPending(true);
    setError(null);
    try {
      await action();
      onDone();
    } catch (reason) {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : "Não deu certo agora. Tente de novo.");
    } finally {
      setPending(false);
    }
  };
  return { run, pending, error, readOnly: preview !== null };
}

function ActionError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="mt-3 rounded-xl border border-alert/40 bg-alert/10 px-3 py-2 text-sm text-[#ffb4b4]">
      {message}
    </p>
  );
}

/** "Liberado para receber: R$ X" e o "Pedir pagamento". Sem lote: cada venda libera quando a garantia acaba. */
export function PayoutCard({ home, onChanged, title = "Seus ganhos" }: { home: AffiliateHome; onChanged: () => void; title?: string }) {
  const portal = useAffiliatePortal();
  const { payout } = home;
  const action = usePanelAction(onChanged);
  const canRequest = canRequestPayout(payout);
  const info = affiliateText(home.program.texts, "payoutInfo", { dias: home.guaranteeDays });
  return (
    <PanelSection title={title}>
      <div className="rounded-2xl border border-electric/40 bg-electric/[0.07] p-4">
        <p className="flex items-center gap-2 text-sm text-fog">
          <Wallet aria-hidden className="size-4 text-electric" /> Liberado para receber
        </p>
        <p className="mt-1 font-display text-3xl font-bold text-white tabular-nums">{formatBRL(payout.readyAmount)}</p>
        <p className="mt-1 text-xs text-mist">
          {payout.ready.length} {payout.ready.length === 1 ? "venda liberada" : "vendas liberadas"}
        </p>
        {payout.requestedAt ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-amber-100">
            <BellRing aria-hidden className="size-4 shrink-0" /> Você pediu o pagamento em {requestedDay.format(new Date(payout.requestedAt))}. A loja já
            recebeu o aviso.
          </p>
        ) : null}
        <Button
          className="mt-4 w-full sm:w-auto"
          disabled={!canRequest || action.pending || action.readOnly}
          onClick={() => void action.run(() => requestAffiliatePayout(portal))}
        >
          <BellRing aria-hidden className="size-4" /> {action.pending ? "Pedindo..." : "Pedir pagamento"}
        </Button>
        {!canRequest && payout.readyAmount > 0 && payout.requestedAt && (
          <p className="mt-2 text-xs text-mist">Dá para pedir de novo 24 horas depois do último pedido.</p>
        )}
        <ActionError message={action.error} />
      </div>
      <p className="mt-4 text-sm text-fog">{info}</p>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-line bg-ink/50 p-3">
          <dt className="flex items-center gap-1 text-xs text-mist">
            <Hourglass aria-hidden className="size-3" /> Na garantia
          </dt>
          <dd className="mt-0.5 font-semibold text-white tabular-nums">{formatBRL(payout.inGuaranteeAmount)}</dd>
          <dd className="text-xs text-mist">
            {payout.inGuarantee.length} {payout.inGuarantee.length === 1 ? "venda" : "vendas"}
          </dd>
        </div>
        <div className="rounded-2xl border border-line bg-ink/50 p-3">
          <dt className="text-xs text-mist">Já recebido</dt>
          <dd className="mt-0.5 font-semibold text-white tabular-nums">{formatBRL(payout.paidAmount)}</dd>
          <dd className="text-xs text-mist">
            {payout.paidCount} {payout.paidCount === 1 ? "venda" : "vendas"}
          </dd>
        </div>
      </dl>
    </PanelSection>
  );
}

/** "Comprar conta com seu saldo": gera o código de uso único, mostra para copiar e deixa cancelar. */
export function BalanceCouponCard({ home, onChanged }: { home: AffiliateHome; onChanged: () => void }) {
  const portal = useAffiliatePortal();
  const action = usePanelAction(onChanged);
  const coupon = home.balanceCoupon;
  const available = home.payout.readyAmount;
  return (
    <PanelSection title="Comprar conta com seu saldo">
      <p className="flex gap-2 text-sm text-fog">
        <ShoppingBag aria-hidden className="mt-0.5 size-4 shrink-0 text-electric" />
        {affiliateText(home.program.texts, "balanceNotice")}
      </p>
      {coupon ? (
        <div className="mt-4 rounded-2xl border border-line bg-ink/60 p-4">
          <p className="text-xs text-mist">Seu código de saldo ({formatBRL(coupon.value)})</p>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
            <span className="min-w-0 flex-1 truncate font-mono text-lg font-semibold tracking-wide text-white">{coupon.code}</span>
            <CopyButton text={coupon.code} label="Copiar código" />
          </div>
          <p className="mt-3 text-xs text-mist">
            Use no checkout, no campo de cupom. Vale uma compra e a conta precisa custar mais que o saldo: você paga só a diferença.
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <Link
              to="/contas"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-ink transition-colors hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
            >
              Ver as contas da vitrine <ArrowRight aria-hidden className="size-4" />
            </Link>
            <Button
              variant="ghost"
              disabled={coupon.inUse || action.pending || action.readOnly}
              onClick={() => void action.run(() => cancelAffiliateBalanceCoupon(portal))}
            >
              <X aria-hidden className="size-4" /> Cancelar o código
            </Button>
          </div>
          {coupon.inUse && <p className="mt-2 text-xs text-amber-100">Esse código está num pedido em aberto. Ele some quando o pedido for pago.</p>}
        </div>
      ) : (
        <div className="mt-4">
          <Button
            variant="secondary"
            disabled={available < MIN_BALANCE_COUPON_CENTS || action.pending || action.readOnly}
            onClick={() => void action.run(() => createAffiliateBalanceCoupon(portal))}
          >
            <ShoppingBag aria-hidden className="size-4" /> {action.pending ? "Gerando..." : `Gerar código de saldo (${formatBRL(available)})`}
          </Button>
          <p className="mt-2 text-xs text-mist">
            {available < MIN_BALANCE_COUPON_CENTS
              ? "O código aparece quando você tiver saldo liberado."
              : "O saldo fica reservado no código até você usar ou cancelar. Enquanto isso, ele não entra no pagamento por Pix."}
          </p>
        </div>
      )}
      <ActionError message={action.error} />
    </PanelSection>
  );
}

/** Regras especiais que valem para ele (as dele e as de todos), para saber quanto ganha em cada tipo de conta. */
export function MyCommissionRules({ home }: { home: AffiliateHome }) {
  if (home.commissionRules.length === 0) return null;
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {home.commissionRules.map((rule) => (
        <li key={rule.id} className="flex items-start gap-2 text-fog">
          <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-electric" />
          <span>
            {commissionRuleSummary(rule, formatBRL)}
            {rule.mine && <span className="ml-1.5 rounded-full bg-electric/15 px-2 py-0.5 text-xs font-semibold text-electric-soft">só sua</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

const SALES_OPTIONS = [5, 10, 20, 50] as const;

/** Exemplos de ganho com as contas que mais rendem agora e uma conta rápida de quanto dá por mês. */
export function EarningsCard({ home }: { home: AffiliateHome }) {
  const rule = ruleFor(home);
  const top = topEarningAccounts(home.store.availableAccounts, home.accountCommissions);
  const [sales, setSales] = useState<number>(10);
  const reference = top[0]?.account.price ?? 150_000;
  return (
    <PanelSection title="Quanto você pode ganhar">
      {top.length > 0 ? (
        <ul className="space-y-2">
          {top.map(({ account, commission }) => (
            <li key={account.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-ink/50 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-semibold text-white">{account.handle}</span>
                <span className="text-xs text-mist">Conta de {formatBRL(account.price)}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-display text-lg font-bold text-electric-soft tabular-nums">{formatBRL(commission)}</span>
                <span className="text-xs text-mist">para você</span>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2 text-sm text-fog">
          {earningExamples(rule).map((example) => (
            <li key={example.price}>{earningSentence(rule, example)}</li>
          ))}
        </ul>
      )}
      <fieldset className="mt-5">
        <legend className="text-sm text-fog">Vendendo por mês contas de {formatBRL(reference)}:</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SALES_OPTIONS.map((option) => (
            <label
              key={option}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-electric",
                sales === option ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
              )}
            >
              <input type="radio" name="vendas-mes" value={option} checked={sales === option} onChange={() => setSales(option)} className="sr-only" />
              {option} vendas
            </label>
          ))}
        </div>
        <p className="mt-3 font-display text-2xl font-bold text-white tabular-nums" aria-live="polite">
          {formatBRL(monthlyEarning(rule, reference, sales))} <span className="text-sm font-normal text-mist">por mês</span>
        </p>
      </fieldset>
    </PanelSection>
  );
}

/** Link que abre o WhatsApp da loja com o código dele: quem chega por ali conta como indicação. */
export function WhatsAppReferral({ code, leads }: { code: string; leads: number }) {
  const link = affiliateWhatsAppLink(window.location.origin, code);
  return (
    <PanelSection
      title="Seu link de WhatsApp"
      action={
        <span className="inline-flex items-center gap-1.5 text-sm text-mist tabular-nums">
          <MessageCircle aria-hidden className="size-4 text-electric" /> {leads} {leads === 1 ? "contato" : "contatos"}
        </span>
      }
    >
      <p className="mb-3 text-sm text-fog">
        Para quem prefere conversar antes de comprar. O link abre o WhatsApp da loja com o seu código na mensagem, e a compra dessa pessoa
        conta para você, mesmo que ela esqueça o cupom.
      </p>
      <LinkBox link={link} />
    </PanelSection>
  );
}

/** Aviso de brinde esperando, para ele não esquecer de pegar. */
export function GiftReminder({ count }: { count: number }) {
  const pathTo = useAffiliatePath();
  if (count === 0) return null;
  return (
    <Link
      to={pathTo("brindes")}
      className="flex items-center gap-3 rounded-2xl border border-electric/40 bg-electric/[0.08] px-4 py-3 text-sm text-white transition-colors hover:bg-electric/[0.14] focus-visible:outline-2 focus-visible:outline-electric"
    >
      <Gift aria-hidden className="size-5 shrink-0 text-electric" />
      <span className="flex-1">
        {count === 1 ? "Você tem um brinde esperando." : `Você tem ${count} brindes esperando.`} Toque para receber.
      </span>
      <ArrowRight aria-hidden className="size-4" />
    </Link>
  );
}
