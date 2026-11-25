import { ArrowRight, Gift, MessageCircle, Rocket, Store, TrendingUp, Users } from "lucide-react";
import { useId, useState } from "react";
import { Link } from "react-router-dom";
import type { AffiliateHome } from "@/application/affiliate-use-cases";
import { commissionRuleLabel, type CommissionRule } from "@/domain/affiliate";
import { affiliateWhatsAppLink, earningExamples, earningSentence, monthlyEarning, topEarningAccounts, type PayoutProgress } from "@/domain/affiliate-rewards";
import { formatBRL } from "@/domain/money";
import { STOCK_CATEGORY_LABEL } from "@/domain/stock";
import { cn } from "@/ui/lib/cn";
import { useAffiliatePath } from "../session";
import { LinkBox, PanelSection } from "./AffiliateUi";

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

/** "10 já pagas, faltam 6 para o próximo pagamento": como o Jota paga, em lotes. */
export function PayoutProgressCard({ progress, title = "Próximo pagamento" }: { progress: PayoutProgress; title?: string }) {
  const percent = Math.round((progress.readyBatches > 0 ? 1 : progress.inCurrentBatch / progress.batchSize) * 100);
  const labelId = useId();
  return (
    <PanelSection title={title}>
      <p className="text-sm text-fog">
        A loja paga a cada <strong className="text-white">{progress.batchSize} indicações</strong> que viram venda.
      </p>
      <div className="mt-4">
        <div className="flex items-baseline justify-between gap-3 text-sm">
          <span id={labelId} className="font-semibold text-white">
            {progress.readyBatches > 0
              ? `${progress.readyBatches === 1 ? "Um pagamento pronto" : `${progress.readyBatches} pagamentos prontos`} para sair`
              : `${progress.inCurrentBatch} de ${progress.batchSize} indicações`}
          </span>
          <span className="text-mist tabular-nums">{formatBRL(progress.waitingAmount)} esperando</span>
        </div>
        <div
          role="progressbar"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/[0.07]"
        >
          <div className="h-full rounded-full bg-electric transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${percent}%` }} />
        </div>
        <p className="mt-2 text-xs text-mist">
          {progress.readyBatches > 0
            ? "O Jota já pode te pagar. Confira se a sua chave Pix está certa no Perfil."
            : `Faltam ${progress.missingForNextBatch} ${progress.missingForNextBatch === 1 ? "indicação" : "indicações"} para fechar o próximo pagamento.`}
        </p>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl border border-line bg-ink/50 p-3">
          <dt className="text-xs text-mist">Já pagas</dt>
          <dd className="mt-0.5 font-semibold text-white tabular-nums">
            {progress.paidCount} {progress.paidCount === 1 ? "indicação" : "indicações"}
          </dd>
          <dd className="text-xs text-mist tabular-nums">{formatBRL(progress.paidAmount)}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-ink/50 p-3">
          <dt className="text-xs text-mist">Esperando pagamento</dt>
          <dd className="mt-0.5 font-semibold text-white tabular-nums">
            {progress.waiting.length} {progress.waiting.length === 1 ? "indicação" : "indicações"}
          </dd>
          <dd className="text-xs text-mist tabular-nums">{formatBRL(progress.waitingAmount)}</dd>
        </div>
      </dl>
    </PanelSection>
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
