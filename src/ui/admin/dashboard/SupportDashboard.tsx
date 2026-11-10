import { motion, useReducedMotion } from "framer-motion";
import { BellRing, CheckCircle2, ChevronRight, Hourglass, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { loadSupportOverview } from "@/application/support-use-cases";
import { SUPPORT_RECENT_DAYS, type CountOf, type SupportOverview } from "@/domain/support-overview";
import {
  SUPPORT_AREA_LABEL,
  SUPPORT_KIND_LABEL,
  SUPPORT_PRIORITY_LABEL,
  formatQueueTime,
  type SupportTicket,
} from "@/domain/support-ticket";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { fadeUp, staggerContainer } from "@/ui/lib/motion";
import { LoadingBlock } from "../components/AdminUi";
import { useAdminQuery } from "../hooks";
import { SUPPORT_PATH } from "../navigation";
import { PRIORITY_TONE } from "../support/priority-tone";
import { PriorityDot, SupportKindBadge, SupportStatusBadge } from "../support/SupportBadges";
import { QueueAgeBadge } from "../support/QueueAgeBadge";
import { StatusDonut, WeeklyChart } from "./SupportCharts";
import { BlockHeading, StatCard } from "./StatCard";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Block({ id, title, link, children, className }: { id: string; title: string; link?: { to: string; label: string }; children: ReactNode; className?: string }) {
  return (
    <motion.section variants={fadeUp} aria-labelledby={id} className={cn("min-w-0", className)}>
      <BlockHeading id={id} title={title} link={link} />
      {children}
    </motion.section>
  );
}

function Headline({ overview }: { overview: SupportOverview }) {
  const average = overview.averageResolveMs === null ? "Nenhum no período" : `Média de ${formatQueueTime(overview.averageResolveMs)} para resolver`;
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard label="Em aberto" value={String(overview.open)} icon={Inbox} tone="electric" hint={plural(overview.urgent, "urgente", "urgentes")} />
      <StatCard
        label="Precisa de você"
        value={String(overview.needsYou)}
        icon={BellRing}
        tone="pink"
        hint={`${overview.inProgress} fazendo agora`}
      />
      <StatCard label="Aguardando o Jota" value={String(overview.waitingAdmin)} icon={Hourglass} tone="amber" hint="Para ele analisar ou aprovar" />
      <StatCard label={`Finalizados em ${SUPPORT_RECENT_DAYS} dias`} value={String(overview.doneRecently)} icon={CheckCircle2} tone="emerald" hint={average} />
    </dl>
  );
}

function QueueRow({ ticket }: { ticket: SupportTicket }) {
  return (
    <li className="relative px-4 py-3 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-center gap-3">
        <PriorityDot priority={ticket.priority} />
        <Link
          to={`${SUPPORT_PATH}/${ticket.id}`}
          className="min-w-0 flex-1 truncate text-sm font-medium text-white after:absolute after:inset-0 hover:text-electric-soft focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-electric"
        >
          <span className="sr-only">{SUPPORT_PRIORITY_LABEL[ticket.priority]}: </span>
          {ticket.title}
        </Link>
        <ChevronRight aria-hidden className="size-4 shrink-0 text-mist" />
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-[1.125rem]">
        <SupportKindBadge kind={ticket.kind} />
        <SupportStatusBadge status={ticket.status} />
        <QueueAgeBadge ticket={ticket} />
      </div>
    </li>
  );
}

function Queue({ overview }: { overview: SupportOverview }) {
  if (overview.queue.length === 0) {
    return (
      <p className="rounded-2xl border border-line bg-surface/70 px-4 py-6 text-center text-sm text-mist">
        Nada esperando por você agora. Quando o Jota abrir ou responder um chamado, ele aparece aqui.
      </p>
    );
  }
  const more = overview.needsYou - overview.queue.length;
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface/70">
      <ul aria-label="Chamados esperando por você" className="divide-y divide-line">
        {overview.queue.map((ticket) => (
          <QueueRow key={ticket.id} ticket={ticket} />
        ))}
      </ul>
      {more > 0 && (
        <Link to={SUPPORT_PATH} className="block border-t border-line px-4 py-2.5 text-center text-xs font-medium text-electric-soft hover:bg-white/[0.03]">
          E mais {plural(more, "chamado", "chamados")} na fila
        </Link>
      )}
    </div>
  );
}

function Bars<K extends string>({ title, items, labelOf, colorOf }: { title: string; items: CountOf<K>[]; labelOf: (key: K) => string; colorOf?: (key: K) => string }) {
  const max = Math.max(1, ...items.map((item) => item.count));
  return (
    <div>
      <h3 className="text-xs font-medium text-fog">{title}</h3>
      <dl className="mt-2 space-y-2">
        {items.map((item) => (
          <div key={item.key} className="grid grid-cols-[6.5rem_minmax(0,1fr)_2rem] items-center gap-3">
            <dt className="truncate text-xs text-mist">{labelOf(item.key)}</dt>
            <dd aria-hidden className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
              <span className={`block h-full rounded-full ${colorOf?.(item.key) ?? "bg-electric"}`} style={{ width: `${(item.count / max) * 100}%` }} />
            </dd>
            <dd className="text-right text-xs font-semibold text-white tabular-nums">{item.count}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function OpenBreakdown({ overview }: { overview: SupportOverview }) {
  const oldest = overview.oldestOpenMs === null ? "Nenhum em aberto" : formatQueueTime(overview.oldestOpenMs);
  return (
    <div className="space-y-5 rounded-2xl border border-line bg-surface/70 p-4 sm:p-5">
      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-mist">Mais antigo em aberto</dt>
          <dd className="mt-0.5 text-sm font-semibold text-white tabular-nums">{oldest}</dd>
        </div>
        <div>
          <dt className="text-xs text-mist">Abertos em {SUPPORT_RECENT_DAYS} dias</dt>
          <dd className="mt-0.5 text-sm font-semibold text-white tabular-nums">{overview.openedRecently}</dd>
        </div>
      </dl>
      <Bars title="Por prioridade" items={overview.byPriority} labelOf={(key) => SUPPORT_PRIORITY_LABEL[key]} colorOf={(key) => PRIORITY_TONE[key].dot} />
      <Bars title="Por tipo" items={overview.byKind} labelOf={(key) => SUPPORT_KIND_LABEL[key]} />
      <Bars title="Por onde" items={overview.byArea} labelOf={(key) => SUPPORT_AREA_LABEL[key]} />
    </div>
  );
}

function SupportContent({ overview }: { overview: SupportOverview }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div variants={reduceMotion ? undefined : staggerContainer} initial="hidden" animate="show" className="space-y-8">
      <motion.div variants={fadeUp}>
        <Headline overview={overview} />
      </motion.div>
      <div className="grid gap-8 lg:grid-cols-5 lg:gap-4">
        <Block id="bloco-ritmo" title="Ritmo por semana" className="lg:col-span-3">
          <WeeklyChart weeks={overview.weeks} />
        </Block>
        <Block id="bloco-situacao" title="Em aberto por situação" className="lg:col-span-2">
          <StatusDonut items={overview.byStatus} />
        </Block>
      </div>
      <div className="grid gap-8 lg:grid-cols-5 lg:gap-4">
        <Block id="bloco-fila" title="Precisa de você" link={{ to: SUPPORT_PATH, label: "Abrir suporte" }} className="lg:col-span-3">
          <Queue overview={overview} />
        </Block>
        <Block id="bloco-abertos" title="Distribuição" className="lg:col-span-2">
          <OpenBreakdown overview={overview} />
        </Block>
      </div>
    </motion.div>
  );
}

/** Dashboard da desenvolvedora: como está o suporte, o que espera por ela e o ritmo das entregas. */
export function SupportDashboard() {
  const overview = useAdminQuery((deps) => loadSupportOverview(deps, "developer"), "support-overview");
  if (overview.status === "loading") return <LoadingBlock />;
  if (overview.status === "error") return <ErrorState message={overview.error.message} onRetry={overview.reload} />;
  return <SupportContent overview={overview.data} />;
}
