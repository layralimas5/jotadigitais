import { BellRing, MessageCircle, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { loadStockAlertsBoard, removeStockAlert, setStockAlertNotified, type AdminDeps } from "@/application/admin-use-cases";
import { siteConfig } from "@/app/config";
import type { StockCategory } from "@/domain/stock";
import {
  STOCK_ALERT_CATEGORIES,
  STOCK_ALERT_CATEGORY_LABEL,
  categoriesInStock,
  categoriesLabel,
  isWaiting,
  readyCategoriesOf,
  type StockAlert,
  type StockAlertCategory,
} from "@/domain/stock-alert";
import { Button } from "@/ui/components/Button";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { useAdminView } from "../admin-view";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterSelect, type FilterOption } from "../components/FilterSelect";
import { Kpi } from "../components/Kpi";
import { SearchInput } from "../components/SearchInput";
import { useAdminQuery, useMutation } from "../hooks";
import { firstNameOf, formatPhone, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";

type StatusFilter = "waiting" | "ready" | "notified" | "all";
type CategoryFilter = StockAlertCategory | "all";

const STATUS_OPTIONS: readonly FilterOption<StatusFilter>[] = [
  { value: "waiting", label: "Aguardando" },
  { value: "ready", label: "Já dá para avisar" },
  { value: "notified", label: "Avisados" },
  { value: "all", label: "Todos" },
];

const CATEGORY_OPTIONS: readonly FilterOption<CategoryFilter>[] = [
  { value: "all", label: "Todos os tipos" },
  ...STOCK_ALERT_CATEGORIES.map((category) => ({ value: category, label: STOCK_ALERT_CATEGORY_LABEL[category] })),
];

const shortDate = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

// Devolvem true para separar "deu certo" do `undefined` de quando a gravação falha.
const markNotified = (deps: AdminDeps, id: string, notified: boolean) => setStockAlertNotified(deps, id, notified).then(() => true);
const dropAlert = (deps: AdminDeps, id: string) => removeStockAlert(deps, id).then(() => true);

/** Mensagem pronta do aviso: fala dos tipos que já chegaram (ou de todos os pedidos, se nenhum chegou ainda). */
function noticeMessage(alert: StockAlert, ready: readonly StockAlertCategory[]): string {
  const categories = ready.length > 0 ? ready : alert.categories;
  return `Oi, ${firstNameOf(alert.name)}! Aqui é o Jota, da Jota Digitais. Você pediu para eu te avisar quando chegasse conta de ${categoriesLabel(categories)}, e chegou! Dá uma olhada: ${siteConfig.url}/contas`;
}

function CategoryChip({ category, ready }: { category: StockAlertCategory; ready: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-semibold",
        ready ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-200" : "border-white/15 bg-white/[0.05] text-fog",
      )}
    >
      {ready && <span aria-hidden className="size-1.5 rounded-full bg-current" />}
      {STOCK_ALERT_CATEGORY_LABEL[category]}
      {ready && <span className="sr-only"> (tem conta disponível)</span>}
    </span>
  );
}

function statusOf(waiting: boolean, readyCount: number) {
  if (!waiting) return { label: "Avisado", tone: "border-white/15 bg-white/[0.05] text-mist" };
  if (readyCount > 0) return { label: "Já dá para avisar", tone: "border-emerald-400/30 bg-emerald-400/[0.08] text-emerald-200" };
  return { label: "Aguardando", tone: "border-amber-300/30 bg-amber-300/[0.08] text-amber-200" };
}

interface AlertCardProps {
  alert: StockAlert;
  inStock: ReadonlySet<StockCategory>;
  readOnly: boolean;
  onChanged: () => void;
}

function AlertCard({ alert, inStock, readOnly, onChanged }: AlertCardProps) {
  const toast = useToast();
  const notified = useMutation(markNotified);
  const remove = useMutation(dropAlert);
  const ready = readyCategoriesOf(alert, inStock);
  const waiting = isWaiting(alert);
  const status = statusOf(waiting, ready.length);
  const busy = notified.pending || remove.pending;
  const error = notified.error ?? remove.error;

  const notify = async () => {
    window.open(whatsappChatUrl(alert.whatsapp, noticeMessage(alert, ready)), "_blank", "noopener,noreferrer");
    if (readOnly || !(await notified.run(alert.id, true))) return;
    toast.show(`${firstNameOf(alert.name)} marcado como avisado.`);
    onChanged();
  };

  const reopen = async () => {
    if (await notified.run(alert.id, false)) onChanged();
  };

  const drop = async () => {
    if (!window.confirm(`Tirar ${alert.name} da lista de espera?`)) return;
    if (!(await remove.run(alert.id))) return;
    toast.show("Removido da lista de espera.");
    onChanged();
  };

  return (
    <li className="rounded-2xl border border-line bg-surface/60 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-white">{alert.name}</p>
          <p className="text-sm text-fog tabular-nums">{formatPhone(alert.whatsapp)}</p>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold", status.tone)}>{status.label}</span>
      </div>
      <ul aria-label="Tipos pedidos" className="mt-3 flex flex-wrap gap-1.5">
        {alert.categories.map((category) => (
          <li key={category}>
            <CategoryChip category={category} ready={waiting && inStock.has(category)} />
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-mist">
        Na lista desde {shortDate.format(new Date(alert.createdAt))}
        {alert.notifiedAt && ` · avisado em ${shortDate.format(new Date(alert.notifiedAt))}`}
      </p>
      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-[#ff7a7a]">
          {error.message}
        </p>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
        {waiting ? (
          <Button variant={ready.length > 0 ? "primary" : "secondary"} onClick={() => void notify()} disabled={busy}>
            <MessageCircle aria-hidden className="size-4" /> Avisar no WhatsApp
          </Button>
        ) : (
          <Button variant="secondary" onClick={() => void reopen()} disabled={busy || readOnly}>
            <RotateCcw aria-hidden className="size-4" /> Voltar para aguardando
          </Button>
        )}
        <Button variant="ghost" onClick={() => void drop()} disabled={busy || readOnly} aria-label={`Tirar ${alert.name} da lista`}>
          <Trash2 aria-hidden className="size-4" />
        </Button>
      </div>
    </li>
  );
}

function matches(alert: StockAlert, query: string): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  const digits = term.replace(/\D/g, "");
  return alert.name.toLowerCase().includes(term) || (digits !== "" && alert.whatsapp.includes(digits));
}

function mostRequested(waiting: readonly StockAlert[]): { category: StockAlertCategory; count: number } | null {
  const ranked = STOCK_ALERT_CATEGORIES.map((category) => ({ category, count: waiting.filter((alert) => alert.categories.includes(category)).length }))
    .filter((item) => item.count > 0)
    .sort((a, b) => b.count - a.count);
  return ranked[0] ?? null;
}

export default function StockAlertsPage() {
  const board = useAdminQuery(loadStockAlertsBoard, "admin-stock-alerts");
  const { previewing } = useAdminView();
  const [status, setStatus] = useState<StatusFilter>("waiting");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [query, setQuery] = useState("");
  const data = board.status === "success" ? board.data : null;
  const inStock = useMemo(() => categoriesInStock(data?.accounts ?? []), [data]);

  const visible = useMemo(() => {
    if (!data) return [];
    return data.alerts.filter((alert) => {
      const waiting = isWaiting(alert);
      if (status === "waiting" && !waiting) return false;
      if (status === "notified" && waiting) return false;
      if (status === "ready" && !(waiting && readyCategoriesOf(alert, inStock).length > 0)) return false;
      if (category !== "all" && !alert.categories.includes(category)) return false;
      return matches(alert, query);
    });
  }, [data, status, category, query, inStock]);

  const waiting = data ? data.alerts.filter(isWaiting) : [];
  const readyCount = waiting.filter((alert) => readyCategoriesOf(alert, inStock).length > 0).length;
  const top = mostRequested(waiting);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lista de espera"
        description="Quem pediu no site para ser avisado quando chegar conta nova. Em verde, o tipo que já tem conta disponível na vitrine. “Avisar no WhatsApp” abre a conversa com a mensagem pronta e marca como avisado."
      />

      {board.status === "loading" && <LoadingBlock />}
      {board.status === "error" && <ErrorState message={board.error.message} onRetry={board.reload} />}
      {data && data.alerts.length === 0 && (
        <EmptyState
          title="Ninguém na lista ainda"
          description="Na vitrine do site tem o botão “Me avise quando chegar conta”. Quem se inscrever aparece aqui, com os tipos de conta que quer."
        />
      )}
      {data && data.alerts.length > 0 && (
        <>
          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Aguardando" value={String(waiting.length)} />
            <Kpi label="Já dá para avisar" value={String(readyCount)} hint="Pediram um tipo que tem conta disponível agora" />
            <Kpi
              label="Tipo mais pedido"
              value={top ? STOCK_ALERT_CATEGORY_LABEL[top.category] : "Nenhum"}
              hint={top ? `${top.count} ${top.count === 1 ? "pessoa esperando" : "pessoas esperando"}` : undefined}
            />
          </dl>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="min-w-0 lg:flex-1">
              <SearchInput label="Buscar na lista" placeholder="Buscar por nome ou WhatsApp" value={query} onChange={setQuery} />
            </div>
            <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0">
              <FilterSelect label="Situação" value={status} options={STATUS_OPTIONS} onChange={setStatus} />
              <FilterSelect label="Tipo de conta" value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
            </div>
          </div>
          {visible.length === 0 ? (
            <EmptyState title="Ninguém com esses filtros" description="Troque a situação ou o tipo de conta." />
          ) : (
            <ul className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
              {visible.map((alert) => (
                <AlertCard key={alert.id} alert={alert} inStock={inStock} readOnly={previewing} onChanged={board.reload} />
              ))}
            </ul>
          )}
        </>
      )}
      <p className="flex items-start gap-2 text-xs text-mist">
        <BellRing aria-hidden className="mt-0.5 size-3.5 shrink-0" />
        Quando a automação do WhatsApp estiver ligada com o número da loja, dá para o aviso sair sozinho quando a conta entrar na vitrine.
      </p>
    </div>
  );
}
