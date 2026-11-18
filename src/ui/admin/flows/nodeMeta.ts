import { Bot, CircleStop, GitBranch, Headset, ListChecks, MessageCircle, MessageSquareText, Play, type LucideIcon } from "lucide-react";
import type { FlowNodeType } from "@/domain/whatsapp-flow";

/** Ícone e cor de cada bloco: a cor só marca o tipo, o resto do bloco é neutro. */
export const NODE_LOOK: Record<FlowNodeType, { icon: LucideIcon; tone: string }> = {
  start: { icon: Play, tone: "text-emerald-300" },
  customer: { icon: MessageCircle, tone: "text-teal-300" },
  message: { icon: MessageSquareText, tone: "text-electric-soft" },
  question: { icon: ListChecks, tone: "text-amber-200" },
  condition: { icon: GitBranch, tone: "text-violet-300" },
  ai: { icon: Bot, tone: "text-sky-300" },
  handoff: { icon: Headset, tone: "text-pink" },
  end: { icon: CircleStop, tone: "text-mist" },
};

/** Tipo arrastado da paleta para o quadro. */
export const DRAG_MIME = "application/x-jota-flow-node";
