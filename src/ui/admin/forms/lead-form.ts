import type { Lead, LeadSource, LeadStage } from "@/domain/lead";
import type { Platform } from "@/domain/platform";
import { formatCentsInput, parseMoneyToCents } from "./account-form";

/** Estado do formulário do CRM: tudo como o Jota digita; a conversão acontece só ao validar. */
export interface LeadFormValues {
  name: string;
  whatsapp: string;
  instagram: string;
  source: LeadSource;
  interest: Platform | "";
  stage: LeadStage;
  budget: string;
  nextFollowUp: string;
  notes: string;
}

export function emptyLeadForm(): LeadFormValues {
  return {
    name: "",
    whatsapp: "",
    instagram: "",
    source: "instagram",
    interest: "",
    stage: "new",
    budget: "",
    nextFollowUp: "",
    notes: "",
  };
}

export function fromLead(lead: Lead): LeadFormValues {
  return {
    name: lead.name,
    whatsapp: lead.whatsapp ?? "",
    instagram: lead.instagram ?? "",
    source: lead.source,
    interest: lead.interest ?? "",
    stage: lead.stage,
    budget: lead.budget === null ? "" : formatCentsInput(lead.budget),
    nextFollowUp: lead.nextFollowUp ?? "",
    notes: lead.notes ?? "",
  };
}

export function toRawLead(values: LeadFormValues) {
  return {
    name: values.name,
    whatsapp: values.whatsapp,
    instagram: values.instagram,
    source: values.source,
    interest: values.interest || null,
    stage: values.stage,
    budget: values.budget.trim() ? parseMoneyToCents(values.budget) : null,
    nextFollowUp: values.nextFollowUp || null,
    notes: values.notes,
  };
}
