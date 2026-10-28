import type { CustomerRecordData } from "./customer";
import type { LegalDocumentSlug } from "./legal/legal-document";
import type { Order } from "./order";

/** Direitos do art. 18 da LGPD (mais a revisão do art. 20 e a oposição do § 2º), na ordem da Política. */
export const DATA_REQUEST_KINDS = [
  "confirmation",
  "access",
  "correction",
  "anonymization",
  "portability",
  "consent_deletion",
  "sharing_info",
  "consent_info",
  "consent_revocation",
  "automated_review",
  "objection",
] as const;
export type DataRequestKind = (typeof DATA_REQUEST_KINDS)[number];

export const DATA_REQUEST_KIND_VIEW: Record<DataRequestKind, { label: string; description: string }> = {
  confirmation: { label: "Confirmar se tratam meus dados", description: "Você recebe a confirmação por escrito." },
  access: { label: "Receber uma cópia dos meus dados", description: "A cópia já aparece aqui embaixo, mas você pode pedir a versão oficial por e-mail." },
  correction: { label: "Corrigir dados", description: "Diga qual dado está errado e qual é o correto." },
  anonymization: { label: "Anonimizar, bloquear ou apagar dados", description: "O que a lei manda guardar (nota fiscal) fica, e explicamos o motivo." },
  portability: { label: "Portabilidade", description: "Seus dados em formato aberto (JSON) para levar a outro fornecedor." },
  consent_deletion: { label: "Apagar o que depende do meu consentimento", description: "Por exemplo, um print seu publicado no site." },
  sharing_info: { label: "Saber com quem meus dados são compartilhados", description: "Lista das empresas e órgãos que recebem os seus dados." },
  consent_info: { label: "Saber o que acontece se eu não consentir", description: "Explicamos as consequências de negar o consentimento." },
  consent_revocation: { label: "Revogar um consentimento", description: "Retira uma autorização dada antes." },
  automated_review: { label: "Revisar decisão automática", description: "Uma pessoa revisa uma decisão tomada só pelo sistema." },
  objection: { label: "Me opor a um tratamento", description: "Para usos baseados no legítimo interesse, como anotações de atendimento." },
};

export type DataRequestStatus = "open" | "done" | "rejected";

export const DATA_REQUEST_STATUS_LABEL: Record<DataRequestStatus, string> = {
  open: "Aberta",
  done: "Respondida",
  rejected: "Recusada",
};

/** Solicitação como o painel vê. */
export interface DataRequest {
  id: string;
  protocol: string;
  kind: DataRequestKind;
  /** Quem entrou com o e-mail tem `email`; quem entrou com o WhatsApp, `whatsapp`. */
  email: string | null;
  whatsapp: string | null;
  orderCode: string | null;
  details: string | null;
  status: DataRequestStatus;
  response: string | null;
  createdAt: string;
  /** Prazo de 15 dias prometido na Política. */
  dueAt: string;
  resolvedAt: string | null;
}

/** Solicitação como o titular vê em Meus dados (sem id interno). */
export type OwnDataRequest = Omit<DataRequest, "id" | "email" | "whatsapp" | "orderCode">;

export interface ConsentRecord {
  orderCode: string;
  slug: LegalDocumentSlug;
  version: string;
  sha256: string;
  acceptedAt: string;
  ipAddress: string | null;
  userAgent: string | null;
}

/** Tudo o que a loja guarda ligado ao contato do titular. Também é o arquivo da portabilidade. */
export interface SubjectData {
  /** E-mail ou WhatsApp (só dígitos) usado para entrar. */
  contact: string;
  generatedAt: string;
  orders: Order[];
  customers: (CustomerRecordData & { createdAt: string })[];
  consents: ConsentRecord[];
  requests: OwnDataRequest[];
}

export interface OpenedDataRequest {
  protocol: string;
  dueAt: string;
}

export interface DataRequestAnswer {
  status: Exclude<DataRequestStatus, "open">;
  response: string | null;
}

export interface AnonymizationResult {
  anonymizedOrders: number;
  /** Pagos ou entregues: ficam pela nota fiscal e pela defesa (só perdem o Instagram). */
  keptOrders: number;
  deletedCustomers: number;
}

export interface RetentionResult {
  anonymizedOrders: number;
  deletedLeads: number;
  deletedNotifications: number;
  deletedRequests: number;
  deletedAttempts: number;
}

export const PRIVACY_RESPONSE_DAYS = 15;

export function isOverdue(request: Pick<DataRequest, "status" | "dueAt">, now: Date = new Date()): boolean {
  return request.status === "open" && new Date(request.dueAt).getTime() < now.getTime();
}

export function generateProtocol(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return `LGPD-${Array.from({ length: 8 }, () => alphabet[Math.floor(random() * alphabet.length)]).join("")}`;
}

/** Mesmo texto do `anonymize_orders` no banco. */
export const ANONYMIZED_NAME = "Titular anonimizado";
export const anonymizedEmail = (orderCode: string) => `anonimo.${orderCode.toLowerCase()}@anonimizado.invalid`;
export const isAnonymizedEmail = (email: string | null) => email?.endsWith("@anonimizado.invalid") ?? false;

/** Contato do titular: e-mail (tem @) ou WhatsApp só com dígitos, como `parse_contact` no banco. */
export const isEmailContact = (contact: string) => contact.includes("@");

export const contactOf = (contact: string) =>
  isEmailContact(contact) ? { email: contact, whatsapp: null } : { email: null, whatsapp: contact };

export function matchesContact(subject: { email: string | null; whatsapp: string | null }, contact: string): boolean {
  return isEmailContact(contact)
    ? subject.email?.toLowerCase() === contact
    : (subject.whatsapp ?? "").replace(/\D/g, "") === contact;
}
