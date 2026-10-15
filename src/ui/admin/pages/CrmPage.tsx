import { ChevronDown, MessageCircle, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { listLeads, moveLead } from "@/application/admin-use-cases";
import {
  LEAD_SOURCE_LABEL,
  LEAD_STAGES,
  LEAD_STAGE_LABEL,
  followUpStatusOf,
  isOpenLead,
  type Lead,
  type LeadStage,
} from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL } from "@/domain/platform";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { FollowUpBadge } from "../components/FollowUpBadge";
import { useAdminQuery, useMessageTemplates, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { personMessage } from "../lib/messages";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";

const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "bg-electric",
  talking: "bg-violet",
  negotiating: "bg-pink",
  won: "bg-emerald-400",
  lost: "bg-mist/60",
};

function matches(lead: Lead, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const digits = needle.replace(/\D/g, "");
  return (
    lead.name.toLowerCase().includes(needle) ||
    (lead.instagram ?? "").toLowerCase().includes(needle) ||
    (digits.length >= 3 && (lead.whatsapp ?? "").includes(digits))
  );
}

const sumBudget = (leads: readonly Lead[]) => leads.reduce((sum, lead) => sum + (lead.budget ?? 0), 0);

function StageSelect({ lead, disabled, onMove }: { lead: Lead; disabled: boolean; onMove: (lead: Lead, stage: LeadStage) => void }) {
  return (
    <label className="relative z-10 inline-flex items-center">
      <span className="sr-only">Mover {lead.name} para</span>
      <select
        value={lead.stage}
        disabled={disabled}
        onChange={(event) => onMove(lead, event.target.value as LeadStage)}
        className="h-8 appearance-none rounded-full border border-line-strong bg-ink pr-7 pl-3 text-xs font-medium text-fog focus:border-electric focus:outline-none disabled:opacity-50"
      >
        {LEAD_STAGES.map((stage) => (
          <option key={stage} value={stage}>
            {LEAD_STAGE_LABEL[stage]}
          </option>
        ))}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2 size-3.5 text-mist" />
    </label>
  );
}

interface LeadCardProps {
  lead: Lead;
  followUpMessage: string;
  today: string;
  busy: boolean;
  onMove: (lead: Lead, stage: LeadStage) => void;
}

function LeadCard({ lead, followUpMessage, today, busy, onMove }: LeadCardProps) {
  const details = [LEAD_SOURCE_LABEL[lead.source], lead.interest ? `quer ${PLATFORM_LABEL[lead.interest]}` : null].filter(Boolean);
  return (
    <li
      className={cn(
        "relative rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong",
        lead.stage === "lost" && "opacity-70",
      )}
    >
      <Link
        to={`/admin/crm/${lead.id}`}
        className="block truncate font-semibold text-white after:absolute after:inset-0 after:rounded-2xl hover:text-electric-soft focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-electric"
      >
        {lead.name}
      </Link>
      <p className="mt-0.5 truncate text-xs text-mist">{details.join(" · ")}</p>
      {(lead.budget !== null || followUpStatusOf(lead, today)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {lead.budget !== null && <span className="text-sm font-semibold text-white tabular-nums">{formatBRL(lead.budget)}</span>}
          <FollowUpBadge lead={lead} today={today} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <StageSelect lead={lead} disabled={busy} onMove={onMove} />
        {lead.whatsapp && (
          <a
            href={whatsappChatUrl(lead.whatsapp, followUpMessage)}
            target="_blank"
            rel="noreferrer"
            aria-label={`Chamar ${lead.name} no WhatsApp`}
            className="relative z-10 grid size-8 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
          >
            <MessageCircle aria-hidden className="size-4" />
          </a>
        )}
      </div>
    </li>
  );
}

interface StageColumnProps {
  stage: LeadStage;
  templates: MessageTemplates;
  leads: Lead[];
  today: string;
  busy: boolean;
  onMove: (lead: Lead, stage: LeadStage) => void;
}

function StageColumn({ stage, templates, leads, today, busy, onMove }: StageColumnProps) {
  const total = sumBudget(leads);
  return (
    <section
      aria-labelledby={`stage-${stage}`}
      className="flex w-[17rem] shrink-0 snap-start flex-col rounded-3xl border border-line bg-night/70 p-3 xl:w-auto"
    >
      <header className="px-1 pb-3">
        <h2 id={`stage-${stage}`} className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap text-white">
          <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STAGE_ACCENT[stage])} />
          {LEAD_STAGE_LABEL[stage]}
          <span className="text-xs font-normal text-mist tabular-nums">{leads.length}</span>
        </h2>
        <p className="mt-0.5 min-h-4 pl-4 text-xs text-mist tabular-nums">{total > 0 && formatBRL(total)}</p>
      </header>
      {leads.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line-strong px-3 py-6 text-center text-xs text-mist">Ninguém nesta etapa</p>
      ) : (
        <ul className="space-y-2.5">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              followUpMessage={personMessage(templates, "crm_follow_up", lead.name)}
              today={today}
              busy={busy}
              onMove={onMove}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function Summary({ leads, today }: { leads: Lead[]; today: string }) {
  const open = leads.filter(isOpenLead);
  const dueCount = open.filter((lead) => {
    const status = followUpStatusOf(lead, today);
    return status === "overdue" || status === "today";
  }).length;
  const items = [
    { label: "Retornar hoje ou atrasados", value: String(dueCount), highlight: dueCount > 0 },
    { label: "Em aberto", value: String(open.length), highlight: false },
    { label: "Valor em negociação", value: formatBRL(sumBudget(open)), highlight: false },
    { label: "Fechados", value: String(leads.filter((lead) => lead.stage === "won").length), highlight: false },
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn("rounded-2xl border p-4", item.highlight ? "border-pink/40 bg-pink/[0.07]" : "border-line bg-surface/60")}
        >
          <dt className="text-xs text-mist">{item.label}</dt>
          <dd className={cn("mt-1 font-display text-xl font-semibold tabular-nums", item.highlight ? "text-pink" : "text-white")}>
            {item.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export default function CrmPage() {
  const leads = useAdminQuery(listLeads, "admin-leads");
  const templates = useMessageTemplates();
  const toast = useToast();
  const move = useMutation(async (deps, id: string, stage: LeadStage) => {
    await moveLead(deps, id, stage);
    return true;
  });
  const [query, setQuery] = useState("");
  const today = localIsoDate();

  const visible = useMemo(
    () => (leads.status === "success" ? leads.data.filter((lead) => matches(lead, query)) : []),
    [leads, query],
  );

  const onMove = async (lead: Lead, stage: LeadStage) => {
    const moved = await move.run(lead.id, stage);
    if (!moved) {
      toast.show("Não foi possível mover o contato.", "error");
      return;
    }
    toast.show(`${firstNameOf(lead.name)} foi para "${LEAD_STAGE_LABEL[stage]}".`);
    leads.reload();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Quem chamou interessado em conta, do primeiro contato até fechar."
        action={
          <ButtonLink to="/admin/crm/novo" className="max-md:hidden">
            <Plus aria-hidden className="size-4" /> Novo lead
          </ButtonLink>
        }
      />

      {leads.status === "loading" && <LoadingBlock />}
      {leads.status === "error" && <ErrorState message={leads.error.message} onRetry={leads.reload} />}
      {leads.status === "success" && leads.data.length === 0 && (
        <EmptyState
          title="Nenhum lead ainda"
          description="Cadastre quem chamou no Instagram ou no WhatsApp perguntando de conta e acompanhe até fechar."
          action={
            <ButtonLink to="/admin/crm/novo">
              <Plus aria-hidden className="size-4" /> Cadastrar o primeiro
            </ButtonLink>
          }
        />
      )}

      {leads.status === "success" && leads.data.length > 0 && (
        <>
          <Summary leads={leads.data} today={today} />
          <label className="relative block lg:max-w-md">
            <span className="sr-only">Buscar lead</span>
            <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mist" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Buscar por nome, @ ou WhatsApp"
              className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-11 text-sm text-white placeholder:text-mist focus:border-electric focus:outline-none"
            />
          </label>
          {move.error && <InlineError message={move.error.message} />}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 xl:mx-0 xl:grid xl:snap-none xl:grid-cols-5 xl:overflow-visible xl:px-0">
            {LEAD_STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                templates={templates}
                leads={visible.filter((lead) => lead.stage === stage)}
                today={today}
                busy={move.pending}
                onMove={(lead, next) => void onMove(lead, next)}
              />
            ))}
          </div>
        </>
      )}

      <Fab to="/admin/crm/novo" label="Novo lead" />
    </div>
  );
}
