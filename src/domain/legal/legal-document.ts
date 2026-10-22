export const LEGAL_DOCUMENT_SLUGS = ["terms", "privacy"] as const;
export type LegalDocumentSlug = (typeof LEGAL_DOCUMENT_SLUGS)[number];

export const LEGAL_DOCUMENT_PATH: Record<LegalDocumentSlug, string> = {
  terms: "/termos-de-uso",
  privacy: "/politica-de-privacidade",
};

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "note"; text: string }
  | { type: "list"; items: string[] }
  | { type: "defs"; items: { term: string; text: string }[] };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: LegalDocumentSlug;
  /** Semver. Texto mudou = versão nova + hash novo em supabase/migrations. */
  version: string;
  /** AAAA-MM-DD */
  effectiveDate: string;
  title: string;
  summary: string;
  sections: LegalSection[];
  history: { version: string; date: string; summary: string }[];
}

/** O que o titular aceitou no checkout: a versão e a impressão digital do texto. */
export interface LegalConsent {
  slug: LegalDocumentSlug;
  version: string;
  sha256: string;
}

/** Dados de quem controla os dados. Nulo = o controlador ainda não preencheu, e o site mostra o aviso. */
export const CONTROLLER_FIELDS = [
  "brand",
  "legalName",
  "document",
  "address",
  "email",
  "privacyEmail",
  "dpoName",
  "dpoEmail",
  "paymentProvider",
  "invoiceProvider",
] as const;
export type ControllerField = (typeof CONTROLLER_FIELDS)[number];
export type LegalController = Record<ControllerField, string | null>;

export const CONTROLLER_FIELD_LABEL: Record<ControllerField, string> = {
  brand: "marca",
  legalName: "nome ou razão social do controlador",
  document: "CNPJ ou CPF do controlador",
  address: "endereço do controlador",
  email: "e-mail de contato",
  privacyEmail: "e-mail para assuntos de privacidade",
  dpoName: "nome do encarregado (DPO)",
  dpoEmail: "e-mail do encarregado (DPO)",
  paymentProvider: "empresa de pagamento",
  invoiceProvider: "emissor de nota fiscal",
};

/** Valores que vêm da loja na hora de exibir (não entram no hash: mudam pelo painel). */
export const STORE_TOKENS = ["guaranteeDays", "instagram"] as const;
export type StoreToken = (typeof STORE_TOKENS)[number];
export type LegalTokenValues = Record<ControllerField | StoreToken, string | null>;

export type InlinePart =
  | { kind: "text"; value: string }
  | { kind: "link"; label: string; href: string }
  /** Campo que o controlador ainda não preencheu. */
  | { kind: "missing"; label: string };

const INLINE_PATTERN = /\{\{(\w+)\}\}|\[([^\]]+)\]\(([^)\s]+)\)/g;

const isTokenKey = (key: string, values: LegalTokenValues): key is keyof LegalTokenValues => key in values;

/** Quebra uma frase do documento em texto, links (`[rótulo](url)`) e campos (`{{campo}}`). */
export function parseInline(text: string, values: LegalTokenValues): InlinePart[] {
  const parts: InlinePart[] = [];
  let cursor = 0;
  for (const match of text.matchAll(INLINE_PATTERN)) {
    if (match.index > cursor) parts.push({ kind: "text", value: text.slice(cursor, match.index) });
    const [whole, token, label, href] = match;
    if (token !== undefined) {
      const value = isTokenKey(token, values) ? values[token] : null;
      const fieldLabel = token in CONTROLLER_FIELD_LABEL ? CONTROLLER_FIELD_LABEL[token as ControllerField] : token;
      parts.push(value ? { kind: "text", value } : { kind: "missing", label: fieldLabel });
    } else if (label !== undefined && href !== undefined) {
      parts.push({ kind: "link", label, href });
    }
    cursor = match.index + whole.length;
  }
  if (cursor < text.length) parts.push({ kind: "text", value: text.slice(cursor) });
  return parts;
}

export function missingControllerFields(controller: LegalController): ControllerField[] {
  return CONTROLLER_FIELDS.filter((field) => !controller[field]);
}
