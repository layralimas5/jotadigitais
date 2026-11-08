import { legalPublishSchema } from "@/application/schemas";
import { CONTROLLER_FIELDS, type LegalController, type LegalDocumentSlug } from "@/domain/legal/legal-document";
import {
  fromDraft,
  LEGAL_LIMITS,
  sameController,
  sameLegalContent,
  toDraft,
  type LegalDocumentDraft,
  type LegalLibrary,
  type LegalPublishInput,
} from "@/domain/legal/legal-editing";
import type { FieldErrors } from "../fields";

export type ControllerDraft = Record<keyof LegalController, string>;

export interface LegalDraftState {
  document: LegalDocumentDraft;
  controller: ControllerDraft;
  note: string;
}

export const OTHER_SLUG: Record<LegalDocumentSlug, LegalDocumentSlug> = { terms: "privacy", privacy: "terms" };

export function initialDraft(library: LegalLibrary, slug: LegalDocumentSlug): LegalDraftState {
  const { document, controller } = library[slug];
  return {
    document: toDraft(document),
    controller: Object.fromEntries(CONTROLLER_FIELDS.map((field) => [field, controller[field] ?? ""])) as ControllerDraft,
    note: "",
  };
}

export const controllerOf = (draft: ControllerDraft): LegalController =>
  Object.fromEntries(CONTROLLER_FIELDS.map((field) => [field, draft[field].trim() || null])) as LegalController;

export interface DraftChanges {
  document: boolean;
  controller: boolean;
}

export function changesOf(library: LegalLibrary, slug: LegalDocumentSlug, draft: LegalDraftState): DraftChanges {
  return {
    document: !sameLegalContent(library[slug].document, fromDraft(draft.document)),
    controller: !sameController(library[slug].controller, controllerOf(draft.controller)),
  };
}

const required = (value: string, max: number, empty: string): string | undefined => {
  const length = value.trim().length;
  if (length === 0) return empty;
  return length > max ? `Use no máximo ${max} caracteres.` : undefined;
};

/** Erros do rascunho pelo caminho do campo ("sections.2.text"), na linguagem de quem edita. */
function draftErrors(draft: LegalDraftState): FieldErrors {
  const errors: FieldErrors = {};
  const set = (path: string, message: string | undefined) => {
    if (message) errors[path] = message;
  };
  set("title", required(draft.document.title, LEGAL_LIMITS.title, "Escreva o título."));
  set("summary", required(draft.document.summary, LEGAL_LIMITS.summary, "Escreva o resumo."));
  if (draft.document.sections.length === 0) errors.sections = "Deixe pelo menos uma seção.";
  draft.document.sections.forEach((section, index) => {
    set(`sections.${index}.title`, required(section.title, LEGAL_LIMITS.sectionTitle, "Escreva o título da seção."));
    set(`sections.${index}.text`, required(section.text, LEGAL_LIMITS.sectionText, "Escreva o texto da seção."));
  });
  for (const field of CONTROLLER_FIELDS) {
    if (draft.controller[field].trim().length > LEGAL_LIMITS.controllerField) {
      errors[`controller.${field}`] = `Use no máximo ${LEGAL_LIMITS.controllerField} caracteres.`;
    }
  }
  const note = draft.note.trim().length;
  if (note < LEGAL_LIMITS.noteMin) errors.note = "Conte em poucas palavras o que mudou. Vai para o histórico de versões.";
  else if (note > LEGAL_LIMITS.note) errors.note = `Use no máximo ${LEGAL_LIMITS.note} caracteres.`;
  return errors;
}

/** Monta o que vai para o banco: o documento editado e o outro como está no ar. */
export function buildPublishInput(
  library: LegalLibrary,
  slug: LegalDocumentSlug,
  draft: LegalDraftState,
): { input: LegalPublishInput | null; errors: FieldErrors } {
  const errors = draftErrors(draft);
  if (Object.keys(errors).length > 0) return { input: null, errors };
  const other = OTHER_SLUG[slug];
  const raw = {
    documents: { [slug]: fromDraft(draft.document), [other]: library[other].document },
    controller: controllerOf(draft.controller),
    note: draft.note,
  };
  const parsed = legalPublishSchema.safeParse(raw);
  if (!parsed.success) {
    // Sobra o que o texto livre não pega, como uma lista com item vazio: aponta a seção.
    const section = parsed.error.issues.find((issue) => issue.path[0] === "documents" && issue.path[2] === "sections");
    const index = section?.path[3];
    return {
      input: null,
      errors: typeof index === "number" ? { [`sections.${index}.text`]: "Confira o texto desta seção: tem item de lista ou linha de tabela vazia." } : { form: "Confira os campos." },
    };
  }
  return { input: parsed.data, errors: {} };
}
