import { Reorder } from "framer-motion";
import { Plus, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { getCrmStageOrder, listLeads, moveLead, saveCrmStageOrder } from "@/application/admin-use-cases";
import { LEAD_STAGES, LEAD_STAGE_LABEL, followUpStatusOf, isOpenLead, type Lead, type LeadStage } from "@/domain/lead";
import { formatBRL } from "@/domain/money";
import { ButtonLink } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { Fab, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { StageColumn, sumBudget } from "../crm/StageColumn";
import { useAdminQuery, useMessageTemplates, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { firstNameOf } from "../lib/whatsapp";
import { useToast } from "../toast";

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

const sameOrder = (a: readonly string[], b: readonly string[]) => a.join(",") === b.join(",");

function swapAt(order: readonly LeadStage[], stage: LeadStage, direction: -1 | 1): LeadStage[] {
  const from = order.indexOf(stage);
  const to = from + direction;
  if (from === -1 || to < 0 || to >= order.length) return [...order];
  const next = [...order];
  [next[from], next[to]] = [next[to] as LeadStage, next[from] as LeadStage];
  return next;
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

/** Ordem das colunas: carrega a salva, muda na hora ao arrastar e grava ao soltar. */
function useStageOrder() {
  const toast = useToast();
  const saved = useAdminQuery(getCrmStageOrder, "crm-stage-order");
  const savedOrder = saved.status === "success" ? saved.data : LEAD_STAGES;
  const savedKey = savedOrder.join(",");
  const [order, setOrder] = useState<LeadStage[]>([...savedOrder]);
  const save = useMutation(saveCrmStageOrder);

  useEffect(() => setOrder(savedKey.split(",") as LeadStage[]), [savedKey]);

  const persist = async (next: LeadStage[]) => {
    if (sameOrder(next, savedOrder)) return;
    const stored = await save.run(next);
    if (!stored) {
      toast.show("Não foi possível salvar a ordem das colunas.", "error");
      setOrder([...savedOrder]);
      return;
    }
    toast.show("Ordem das colunas salva.");
    saved.reload();
  };

  return {
    order,
    setOrder,
    persist: () => void persist(order),
    moveWithKeyboard: (stage: LeadStage, direction: -1 | 1) => {
      const next = swapAt(order, stage, direction);
      setOrder(next);
      void persist(next);
    },
  };
}

export default function CrmPage() {
  const leads = useAdminQuery(listLeads, "admin-leads");
  const templates = useMessageTemplates();
  const toast = useToast();
  const columns = useStageOrder();
  const move = useMutation(async (deps, id: string, stage: LeadStage) => {
    await moveLead(deps, id, stage);
    return true;
  });
  const [query, setQuery] = useState("");
  const [hoverStage, setHoverStage] = useState<LeadStage | null>(null);
  const [pendingMoves, setPendingMoves] = useState<Record<string, LeadStage>>({});
  const today = localIsoDate();
  const loaded = leads.status === "success" ? leads.data : null;

  useEffect(() => setPendingMoves({}), [loaded]);

  const current = useMemo(
    () => (loaded ?? []).map((lead) => (pendingMoves[lead.id] ? { ...lead, stage: pendingMoves[lead.id] as LeadStage } : lead)),
    [loaded, pendingMoves],
  );
  const visible = useMemo(() => current.filter((lead) => matches(lead, query)), [current, query]);

  const onMoveLead = async (lead: Lead, stage: LeadStage) => {
    setPendingMoves((moves) => ({ ...moves, [lead.id]: stage }));
    const moved = await move.run(lead.id, stage);
    if (!moved) {
      setPendingMoves(({ [lead.id]: _undone, ...rest }) => rest);
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
        description="Segure um card e solte em outra coluna. Segure o topo de uma coluna para mudar ela de lugar."
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
          <Summary leads={current} today={today} />
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
          <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8 xl:mx-0 xl:overflow-visible xl:px-0">
            <Reorder.Group
              as="div"
              axis="x"
              values={columns.order}
              onReorder={columns.setOrder}
              className="flex w-max snap-x snap-mandatory gap-3 xl:grid xl:w-auto xl:snap-none xl:grid-cols-5"
            >
              {columns.order.map((stage, index) => (
                <StageColumn
                  key={stage}
                  stage={stage}
                  position={index + 1}
                  total={columns.order.length}
                  leads={visible.filter((lead) => lead.stage === stage)}
                  templates={templates}
                  today={today}
                  busy={move.pending}
                  isDropTarget={hoverStage === stage}
                  onMoveLead={(lead, next) => void onMoveLead(lead, next)}
                  onHoverStage={setHoverStage}
                  onColumnDragEnd={columns.persist}
                  onColumnKeyboardMove={(direction) => columns.moveWithKeyboard(stage, direction)}
                />
              ))}
            </Reorder.Group>
          </div>
        </>
      )}

      <Fab to="/admin/crm/novo" label="Novo lead" />
    </div>
  );
}
