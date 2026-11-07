import { Bug, EyeOff, ListTodo, Sparkles, type LucideIcon } from "lucide-react";
import {
  SUPPORT_AREA_LABEL,
  SUPPORT_KIND_LABEL,
  SUPPORT_PRIORITY_LABEL,
  SUPPORT_STATUS_LABEL,
  type SupportArea,
  type SupportAuthor,
  type SupportKind,
  type SupportLabel,
  type SupportPriority,
  type SupportStatus,
} from "@/domain/support-ticket";
import { cn } from "@/ui/lib/cn";
import { LABEL_TONE } from "./label-tone";
import { PRIORITY_TONE } from "./priority-tone";

const pill = "inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";

export const STATUS_TONE: Record<SupportStatus, string> = {
  open: "border-pink/30 bg-pink/10 text-pink",
  in_progress: "border-electric/40 bg-electric/10 text-electric-soft",
  waiting: "border-amber-300/40 bg-amber-300/10 text-amber-200",
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export const KIND_ICON: Record<SupportKind, LucideIcon> = { problem: Bug, improvement: Sparkles, task: ListTodo };

export function SupportStatusBadge({ status }: { status: SupportStatus }) {
  return <span className={cn(pill, STATUS_TONE[status])}>{SUPPORT_STATUS_LABEL[status]}</span>;
}

export function PriorityDot({ priority, className }: { priority: SupportPriority; className?: string }) {
  return <span aria-hidden className={cn("dot-glow size-1.5 shrink-0 rounded-full", PRIORITY_TONE[priority].dot, className)} />;
}

export function SupportPriorityBadge({ priority }: { priority: SupportPriority }) {
  return (
    <span className={cn(pill, "gap-1.5", PRIORITY_TONE[priority].badge)}>
      <PriorityDot priority={priority} />
      {SUPPORT_PRIORITY_LABEL[priority]}
    </span>
  );
}

export function SupportKindBadge({ kind }: { kind: SupportKind }) {
  const Icon = KIND_ICON[kind];
  return (
    <span className={cn(pill, "gap-1.5 border-line-strong text-fog")}>
      <Icon aria-hidden className="size-3" />
      {SUPPORT_KIND_LABEL[kind]}
    </span>
  );
}

export function SupportAreaBadge({ area }: { area: SupportArea }) {
  return <span className={cn(pill, "border-line-strong text-mist")}>{SUPPORT_AREA_LABEL[area]}</span>;
}

/** Chamado esperando a ação de quem está vendo. */
export function NeedsYouBadge() {
  return <span className={cn(pill, "border-white/25 bg-white text-ink")}>Precisa de você</span>;
}

/** Chamado interno: só a desenvolvedora vê. */
export function InternalBadge() {
  return (
    <span className={cn(pill, "gap-1.5 border-violet-400/30 bg-violet-400/10 text-violet-200")} title="O Jota não vê este chamado">
      <EyeOff aria-hidden className="size-3" />
      Só você vê
    </span>
  );
}

/** Finalizado pelo Jota, aprovando o que estava esperando por ele. */
export function ApprovedByAdminBadge() {
  return <span className={cn(pill, "border-emerald-400/30 bg-emerald-400/10 text-emerald-300")}>Jota aprovou</span>;
}

/** "Jota" ou "Layra"; quem foi removido do sistema vira "Usuário removido". */
export const authorNameOf = (author: SupportAuthor | null): string => author?.name ?? (author ? "Sem nome" : "Usuário removido");

export function SupportLabelBadge({ label }: { label: SupportLabel }) {
  return (
    <span className={cn(pill, "gap-1.5", LABEL_TONE[label.color].badge)}>
      <span aria-hidden className={cn("dot-glow size-1.5 shrink-0 rounded-full", LABEL_TONE[label.color].dot)} />
      {label.name}
    </span>
  );
}
