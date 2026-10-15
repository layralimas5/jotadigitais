import type { Cents } from "./money";
import type { Platform } from "./platform";

export const LEAD_STAGES = ["new", "talking", "negotiating", "won", "lost"] as const;
export type LeadStage = (typeof LEAD_STAGES)[number];

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: "Novo contato",
  talking: "Em conversa",
  negotiating: "Negociando",
  won: "Fechado",
  lost: "Perdido",
};

export const LEAD_SOURCES = ["instagram", "whatsapp", "tiktok", "referral", "other"] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  tiktok: "TikTok",
  referral: "Indicação",
  other: "Outro",
};

/** Pessoa interessada em comprar uma conta, acompanhada pelo Jota até fechar ou desistir. */
export interface LeadData {
  name: string;
  /** Só dígitos, com DDD (o DDI 55 é opcional). */
  whatsapp: string | null;
  instagram: string | null;
  source: LeadSource;
  /** Rede da conta que a pessoa procura; nulo quando ainda não sabe. */
  interest: Platform | null;
  stage: LeadStage;
  budget: Cents | null;
  /** Data (AAAA-MM-DD) para chamar de novo. */
  nextFollowUp: string | null;
  notes: string | null;
}

export interface Lead extends LeadData {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export type FollowUpStatus = "overdue" | "today" | "upcoming";

export const isOpenLead = (lead: Pick<Lead, "stage">) => lead.stage !== "won" && lead.stage !== "lost";

/** Só conta para quem ainda está no funil: lead fechado ou perdido não precisa de retorno. */
export function followUpStatusOf(lead: Pick<Lead, "stage" | "nextFollowUp">, today: string): FollowUpStatus | null {
  if (!lead.nextFollowUp || !isOpenLead(lead)) return null;
  if (lead.nextFollowUp < today) return "overdue";
  return lead.nextFollowUp === today ? "today" : "upcoming";
}
