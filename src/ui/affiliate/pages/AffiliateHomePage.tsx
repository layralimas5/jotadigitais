import { ArrowRight, Megaphone, Pin, TicketPercent, Trophy } from "lucide-react";
import { Link } from "react-router-dom";
import { loadAffiliateHome, type AffiliateHome } from "@/application/affiliate-use-cases";
import { affiliateLink, commissionRuleLabel } from "@/domain/affiliate";
import { earningExamples, earningSentence } from "@/domain/affiliate-rewards";
import { container } from "@/app/container";
import { formatBRL } from "@/domain/money";
import { CommissionList } from "@/ui/components/affiliate/CommissionList";
import { ErrorState } from "@/ui/components/StateViews";
import { useAsync } from "@/ui/hooks/useAsync";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { cn } from "@/ui/lib/cn";
import { AffiliateSpinner } from "../AffiliateLayout";
import { AffiliateBanner, EarningsCard, GiftReminder, PayoutProgressCard, StoreNumbers, WhatsAppReferral, ruleFor } from "../components/AffiliateRewards";
import { CopyButton, LinkBox, PanelSection, StatTile } from "../components/AffiliateUi";
import { useAffiliateMe, useAffiliatePath, useAffiliatePortal } from "../session";

const day = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

function Stats({ home }: { home: AffiliateHome }) {
  const { totals, clicks, conversion } = home;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Saldo liberado" value={formatBRL(totals.balance)} hint="Garantia já acabou" highlight />
      <StatTile label="Pendente" value={formatBRL(totals.pending)} hint="Libera quando a garantia acabar" />
      <StatTile label="Vendas" value={String(totals.sales)} hint={`${formatBRL(totals.pending + totals.released + totals.paid)} em comissões`} />
      <StatTile label="Cliques" value={String(clicks.length)} hint={conversion === null ? "Divulgue o seu link" : `${conversion.toLocaleString("pt-BR")}% viraram venda`} />
    </dl>
  );
}

function QuickShare({ home }: { home: AffiliateHome }) {
  const { me, program } = home;
  const pathTo = useAffiliatePath();
  const link = affiliateLink(window.location.origin, me.code);
  const rule = ruleFor(home);
  const [example] = earningExamples(rule, [150_000]);
  return (
    <PanelSection
      title="Seu link da loja"
      action={
        <Link to={pathTo("divulgar")} className="inline-flex items-center gap-1 text-sm font-medium text-electric hover:text-white">
          Links por conta <ArrowRight aria-hidden className="size-4" />
        </Link>
      }
    >
      <p className="mb-3 text-sm text-fog">
        {commissionRuleLabel(rule, formatBRL)}. Quem clicar e comprar em até {program.linkDays} dias conta para você.
        {example && <span className="mt-1 block font-medium text-white">Exemplo: {earningSentence(rule, example)}.</span>}
      </p>
      <LinkBox link={link} />
      {me.coupon && (
        <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-line bg-ink/60 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm text-fog">
            <TicketPercent aria-hidden className="size-5 shrink-0 text-electric" />
            <span>
              Seu cupom <strong className="font-mono text-white">{me.coupon.code}</strong> dá{" "}
              {me.coupon.kind === "percent" ? `${me.coupon.value}%` : formatBRL(me.coupon.value)} de desconto e a venda é sua.
            </span>
          </p>
          <CopyButton text={me.coupon.code} label="Copiar cupom" />
        </div>
      )}
    </PanelSection>
  );
}

function Mural({ home }: { home: AffiliateHome }) {
  if (home.announcements.length === 0) return null;
  return (
    <PanelSection title="Mural da loja">
      <ul className="space-y-3">
        {home.announcements.slice(0, 5).map((item) => (
          <li key={item.id} className="rounded-2xl border border-line bg-ink/50 p-4">
            <p className="flex items-center gap-2 font-semibold text-white">
              {item.pinned ? <Pin aria-label="Fixado" className="size-4 text-electric" /> : <Megaphone aria-hidden className="size-4 text-mist" />}
              {item.title}
            </p>
            <p className="mt-0.5 text-xs text-mist">{day.format(new Date(item.createdAt))}</p>
            <p className="mt-2 text-sm whitespace-pre-line text-fog">{item.body}</p>
          </li>
        ))}
      </ul>
    </PanelSection>
  );
}

function Ranking({ home }: { home: AffiliateHome }) {
  return (
    <PanelSection title="Quem mais vendeu (30 dias)">
      {home.ranking.length === 0 ? (
        <p className="text-sm text-mist">Ainda não teve venda de afiliado nos últimos 30 dias. A primeira pode ser sua.</p>
      ) : (
        <ol className="space-y-1.5">
          {home.ranking.map((entry) => (
            <li
              key={entry.rank}
              className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-sm", entry.isMe ? "bg-electric/10 text-white" : "text-fog")}
            >
              <span className={cn("w-6 text-center font-display font-bold tabular-nums", entry.rank <= 3 ? "text-amber-300" : "text-mist")}>
                {entry.rank <= 3 ? <Trophy aria-label={`${entry.rank}º`} className="mx-auto size-4" /> : `${entry.rank}º`}
              </span>
              <span className="flex-1 truncate">
                {entry.displayName}
                {entry.isMe && <span className="ml-1.5 text-xs text-electric">(você)</span>}
              </span>
              <span className="tabular-nums">
                {entry.sales} {entry.sales === 1 ? "venda" : "vendas"}
              </span>
            </li>
          ))}
        </ol>
      )}
    </PanelSection>
  );
}

export default function AffiliateHomePage() {
  useDocumentMeta("Painel do afiliado");
  const me = useAffiliateMe();
  const affiliatePortal = useAffiliatePortal();
  const pathTo = useAffiliatePath();
  const home = useAsync(() => loadAffiliateHome(affiliatePortal, container.store.accounts, me), `affiliate-home:${me.id}:${me.status}`);

  if (home.status === "loading") return <AffiliateSpinner />;
  if (home.status === "error") return <ErrorState message={home.error.message} onRetry={home.retry} />;
  const data = home.data;
  const approved = me.status === "approved";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Olá, {me.name.split(" ")[0]}</h1>
        {data.program.welcomeText && approved && <p className="mt-2 max-w-2xl text-sm whitespace-pre-line text-fog">{data.program.welcomeText}</p>}
      </div>
      <GiftReminder count={data.giftsToClaim} />
      {approved && <AffiliateBanner home={data} />}
      <Stats home={data} />
      {approved && <StoreNumbers home={data} />}
      {approved && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            <QuickShare home={data} />
            <WhatsAppReferral code={me.code} leads={data.whatsappLeads} />
            <Mural home={data} />
          </div>
          <div className="space-y-6">
            <PayoutProgressCard progress={data.payout} />
            <EarningsCard home={data} />
            <Ranking home={data} />
          </div>
        </div>
      )}
      {data.commissions.length > 0 && (
        <PanelSection
          title="Últimas vendas"
          action={
            <Link to={pathTo("extrato")} className="inline-flex items-center gap-1 text-sm font-medium text-electric hover:text-white">
              Extrato completo <ArrowRight aria-hidden className="size-4" />
            </Link>
          }
        >
          <CommissionList commissions={data.commissions.slice(0, 5)} />
        </PanelSection>
      )}
    </div>
  );
}
