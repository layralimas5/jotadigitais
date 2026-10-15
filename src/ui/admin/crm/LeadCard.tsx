import { motion, useDragControls, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronDown, GripVertical, MessageCircle } from "lucide-react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { LEAD_SOURCE_LABEL, LEAD_STAGES, LEAD_STAGE_LABEL, followUpStatusOf, type Lead, type LeadStage } from "@/domain/lead";
import { formatBRL } from "@/domain/money";
import { PLATFORM_LABEL } from "@/domain/platform";
import { cn } from "@/ui/lib/cn";
import { FollowUpBadge } from "../components/FollowUpBadge";
import { whatsappChatUrl } from "../lib/whatsapp";
import { stageAtPoint, useHoldToDrag } from "./drag";

/** Alternativa ao arraste para teclado e leitor de tela. */
function StageSelect({ lead, disabled, onMove }: { lead: Lead; disabled: boolean; onMove: (stage: LeadStage) => void }) {
  return (
    <label className="relative z-10 inline-flex items-center">
      <span className="sr-only">Mover {lead.name} para</span>
      <select
        value={lead.stage}
        disabled={disabled}
        onChange={(event) => onMove(event.target.value as LeadStage)}
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
  onHoverStage: (stage: LeadStage | null) => void;
}

/** Card do lead: segure e arraste para outra coluna (mouse na hora; no toque, segurando um instante). */
export function LeadCard({ lead, followUpMessage, today, busy, onMove, onHoverStage }: LeadCardProps) {
  const controls = useDragControls();
  const reduceMotion = useReducedMotion();
  const ref = useRef<HTMLLIElement>(null);
  const hold = useHoldToDrag(controls, ref, busy);
  const details = [LEAD_SOURCE_LABEL[lead.source], lead.interest ? `quer ${PLATFORM_LABEL[lead.interest]}` : null].filter(Boolean);

  const onDragEnd = (_event: PointerEvent | MouseEvent | TouchEvent, info: PanInfo) => {
    hold.onDragEnd();
    onHoverStage(null);
    const target = stageAtPoint(info.point.x, info.point.y, ref.current);
    if (target && target !== lead.stage) onMove(lead, target);
  };

  return (
    <motion.li
      ref={ref}
      drag
      dragControls={controls}
      dragListener={false}
      dragSnapToOrigin
      dragElastic={0}
      dragMomentum={false}
      onDragStart={hold.onDragStart}
      onDrag={(_event, info) => onHoverStage(stageAtPoint(info.point.x, info.point.y, ref.current))}
      onDragEnd={onDragEnd}
      whileDrag={{ scale: 1.04, rotate: reduceMotion ? 0 : -1.5, zIndex: 50, boxShadow: "0 24px 60px -12px rgb(0 0 0 / 0.85)" }}
      onClickCapture={(event) => hold.shouldIgnoreClick() && event.preventDefault()}
      {...hold.handlers}
      className={cn(
        "relative rounded-2xl border border-line bg-surface p-3.5 transition-colors select-none [-webkit-touch-callout:none] hover:border-line-strong md:cursor-grab md:active:cursor-grabbing",
        lead.stage === "lost" && "opacity-70",
      )}
    >
      <div className="flex items-start gap-2">
        <Link
          to={`/admin/crm/${lead.id}`}
          draggable={false}
          className="block min-w-0 flex-1 truncate font-semibold text-white after:absolute after:inset-0 after:rounded-2xl hover:text-electric-soft focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-electric"
        >
          {lead.name}
        </Link>
        <GripVertical aria-hidden className="size-4 shrink-0 text-mist/70" />
      </div>
      <p className="mt-0.5 truncate text-xs text-mist">{details.join(" · ")}</p>
      {(lead.budget !== null || followUpStatusOf(lead, today)) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {lead.budget !== null && <span className="text-sm font-semibold text-white tabular-nums">{formatBRL(lead.budget)}</span>}
          <FollowUpBadge lead={lead} today={today} />
        </div>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
        <StageSelect lead={lead} disabled={busy} onMove={(stage) => onMove(lead, stage)} />
        {lead.whatsapp && (
          <a
            href={whatsappChatUrl(lead.whatsapp, followUpMessage)}
            target="_blank"
            rel="noreferrer"
            draggable={false}
            aria-label={`Chamar ${lead.name} no WhatsApp`}
            className="relative z-10 grid size-8 place-items-center rounded-full border border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20"
          >
            <MessageCircle aria-hidden className="size-4" />
          </a>
        )}
      </div>
    </motion.li>
  );
}
