import { Reorder, useDragControls, useReducedMotion } from "framer-motion";
import { GripHorizontal } from "lucide-react";
import { useRef, type KeyboardEvent } from "react";
import { LEAD_STAGE_LABEL, type Lead, type LeadStage } from "@/domain/lead";
import type { MessageTemplates } from "@/domain/message-template";
import { formatBRL } from "@/domain/money";
import { cn } from "@/ui/lib/cn";
import { personMessage } from "../lib/messages";
import { dropZoneProps, useHoldToDrag } from "./drag";
import { LeadCard } from "./LeadCard";

const STAGE_ACCENT: Record<LeadStage, string> = {
  new: "bg-electric",
  talking: "bg-violet",
  negotiating: "bg-pink",
  won: "bg-emerald-400",
  lost: "bg-mist/60",
};

export const sumBudget = (leads: readonly Lead[]) => leads.reduce((sum, lead) => sum + (lead.budget ?? 0), 0);

interface StageColumnProps {
  stage: LeadStage;
  position: number;
  total: number;
  leads: Lead[];
  templates: MessageTemplates;
  today: string;
  busy: boolean;
  isDropTarget: boolean;
  onMoveLead: (lead: Lead, stage: LeadStage) => void;
  onHoverStage: (stage: LeadStage | null) => void;
  onColumnDragEnd: () => void;
  onColumnKeyboardMove: (direction: -1 | 1) => void;
}

/** Coluna do quadro: recebe cards soltos nela e pode trocar de lugar segurando o topo. */
export function StageColumn(props: StageColumnProps) {
  const { stage, position, total, leads, templates, today, busy, isDropTarget } = props;
  const controls = useDragControls();
  const reduceMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);
  const hold = useHoldToDrag(controls, headerRef, busy);
  const amount = sumBudget(leads);

  const onHandleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === "ArrowLeft") props.onColumnKeyboardMove(-1);
    else if (event.key === "ArrowRight") props.onColumnKeyboardMove(1);
    else return;
    event.preventDefault();
  };

  return (
    <Reorder.Item
      as="section"
      value={stage}
      dragListener={false}
      dragControls={controls}
      onDragStart={hold.onDragStart}
      onDragEnd={() => {
        hold.onDragEnd();
        props.onColumnDragEnd();
      }}
      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 42 }}
      whileDrag={{ scale: 1.02, zIndex: 40, boxShadow: "0 30px 70px -20px rgb(0 0 0 / 0.9)" }}
      aria-labelledby={`stage-${stage}`}
      {...dropZoneProps(stage)}
      className={cn(
        "flex w-[17rem] shrink-0 snap-start flex-col rounded-3xl border bg-night p-3 transition-colors xl:w-auto",
        isDropTarget ? "border-electric/60 bg-electric/[0.05]" : "border-line",
      )}
    >
      <header
        ref={headerRef}
        {...hold.handlers}
        className="flex items-start gap-1 px-1 pb-3 select-none [-webkit-touch-callout:none] md:cursor-grab md:active:cursor-grabbing"
      >
        <div className="min-w-0 flex-1">
          <h2 id={`stage-${stage}`} className="flex items-center gap-2 text-sm font-semibold whitespace-nowrap text-white">
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", STAGE_ACCENT[stage])} />
            {LEAD_STAGE_LABEL[stage]}
            <span className="text-xs font-normal text-mist tabular-nums">{leads.length}</span>
          </h2>
          <p className="mt-0.5 min-h-4 pl-4 text-xs text-mist tabular-nums">{amount > 0 && formatBRL(amount)}</p>
        </div>
        <button
          type="button"
          aria-label={`Mudar a posição da coluna ${LEAD_STAGE_LABEL[stage]}, hoje ${position} de ${total}. Use as setas para mover.`}
          title="Segure e arraste para mudar a coluna de lugar"
          onKeyDown={onHandleKeyDown}
          className="grid size-7 shrink-0 place-items-center rounded-lg text-mist hover:bg-white/[0.06] hover:text-white"
        >
          <GripHorizontal aria-hidden className="size-4" />
        </button>
      </header>
      {leads.length === 0 ? (
        <p
          className={cn(
            "rounded-2xl border border-dashed px-3 py-6 text-center text-xs transition-colors",
            isDropTarget ? "border-electric/60 text-electric-soft" : "border-line-strong text-mist",
          )}
        >
          {isDropTarget ? "Solte aqui" : "Ninguém nesta etapa"}
        </p>
      ) : (
        <ul className="space-y-2.5">
          {leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              followUpMessage={personMessage(templates, "crm_follow_up", lead.name)}
              today={today}
              busy={busy}
              onMove={props.onMoveLead}
              onHoverStage={props.onHoverStage}
            />
          ))}
        </ul>
      )}
    </Reorder.Item>
  );
}
