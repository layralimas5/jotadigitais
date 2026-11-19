import { BellRing, Bot, CircleDollarSign, HandHelping, Inbox, KeyRound, MessageCircle, MessagesSquare, Send, UserPlus, UserRound } from "lucide-react";
import { useState } from "react";
import { getWhatsAppReport } from "@/application/admin-use-cases";
import { formatBRL } from "@/domain/money";
import { REPORT_PERIODS, shareOf, type ReportPeriod, type WhatsAppMode, type WhatsAppReport } from "@/domain/whatsapp";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "../components/AdminUi";
import { BlockHeading, StatCard } from "../dashboard/StatCard";
import { useAdminQuery } from "../hooks";

const PERIOD_LABEL: Record<ReportPeriod, string> = { 7: "7 dias", 30: "30 dias", 90: "90 dias" };

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function PeriodPicker({ value, onChange }: { value: ReportPeriod; onChange: (period: ReportPeriod) => void }) {
  return (
    <div role="radiogroup" aria-label="Período do relatório" className="inline-flex rounded-full border border-line bg-ink/60 p-1 text-xs">
      {REPORT_PERIODS.map((period) => (
        <button
          key={period}
          type="button"
          role="radio"
          aria-checked={value === period}
          onClick={() => onChange(period)}
          className={cn("rounded-full px-3 py-1.5", value === period ? "bg-white/[0.1] font-semibold text-white" : "text-mist hover:text-white")}
        >
          {PERIOD_LABEL[period]}
        </button>
      ))}
    </div>
  );
}

function ServiceBlock({ report }: { report: WhatsAppReport }) {
  return (
    <section aria-labelledby="report-service">
      <BlockHeading id="report-service" title="Atendimento" />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Conversas" value={String(report.conversations)} icon={MessagesSquare} tone="electric" hint={plural(report.received, "mensagem recebida", "mensagens recebidas")} />
        <StatCard label="Contatos novos" value={String(report.newContacts)} icon={UserPlus} tone="pink" />
        <StatCard
          label="Resolvidas pela IA"
          value={`${shareOf(report.aiOnly, report.conversations)}%`}
          icon={Bot}
          tone="emerald"
          hint={`${plural(report.aiOnly, "conversa", "conversas")} sem você escrever`}
        />
        <StatCard label="Passadas para você" value={String(report.handoffs)} icon={HandHelping} tone="amber" hint={`${report.waitingNow} esperando agora`} />
        <StatCard label="Respostas da IA" value={String(report.aiReplies)} icon={Bot} tone="electric" />
        <StatCard label="Suas respostas" value={String(report.staffReplies)} icon={UserRound} tone="pink" />
      </dl>
    </section>
  );
}

function SalesBlock({ report }: { report: WhatsAppReport }) {
  return (
    <section aria-labelledby="report-sales">
      <BlockHeading id="report-sales" title="Vendas e entregas" />
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Vendas de quem conversou antes"
          value={formatBRL(report.chatSalesCents)}
          icon={CircleDollarSign}
          tone="emerald"
          hint={plural(report.chatSales, "pedido pago", "pedidos pagos")}
        />
        <StatCard label="Acessos entregues" value={String(report.accessDelivered)} icon={KeyRound} tone="electric" hint="Pelo WhatsApp, sem você" />
        <StatCard
          label="Pagos depois do lembrete"
          value={String(report.remindersPaid)}
          icon={BellRing}
          tone="amber"
          hint={`de ${plural(report.remindersSent, "lembrete", "lembretes")} (${shareOf(report.remindersPaid, report.remindersSent)}%)`}
        />
        <StatCard label="Pós-venda enviados" value={String(report.afterSalesSent)} icon={Send} tone="pink" />
      </dl>
    </section>
  );
}

function ReportBody({ days, mode }: { days: ReportPeriod; mode: WhatsAppMode }) {
  const report = useAdminQuery((deps) => getWhatsAppReport(deps, days), `whatsapp-report:${days}`);
  if (report.status === "loading") return <LoadingBlock />;
  if (report.status === "error") return <ErrorState message={report.error.message} onRetry={report.reload} />;
  const data = report.data;
  const empty = data.conversations === 0 && data.accessDelivered === 0 && data.remindersSent === 0 && data.chatSales === 0;
  return (
    <div className="space-y-8">
      {mode === "test" && (
        <p className="flex items-center gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/[0.05] px-4 py-3 text-sm text-amber-100">
          <MessageCircle aria-hidden className="size-4 shrink-0 text-amber-200" />
          Modo teste: os envios contados aqui foram só registrados, nada saiu para os clientes.
        </p>
      )}
      {empty && (
        <p className="flex items-center gap-2 text-sm text-mist">
          <Inbox aria-hidden className="size-4" /> Nada no WhatsApp nos últimos {PERIOD_LABEL[days]} ainda.
        </p>
      )}
      <ServiceBlock report={data} />
      <SalesBlock report={data} />
    </div>
  );
}

/** WhatsApp > Relatório: quanto a IA resolve sozinha, o que vira venda e o que os lembretes recuperam. */
export function WhatsAppReportPanel({ mode }: { mode: WhatsAppMode }) {
  const [days, setDays] = useState<ReportPeriod>(30);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-mist">Últimos {PERIOD_LABEL[days]}.</p>
        <PeriodPicker value={days} onChange={setDays} />
      </div>
      <ReportBody key={days} days={days} mode={mode} />
    </div>
  );
}
