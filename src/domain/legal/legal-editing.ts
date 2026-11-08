import type { LegalBlock, LegalController, LegalDocument, LegalDocumentSlug, LegalSection } from "./legal-document";

/** O que o painel edita em cada documento. Versão, data e histórico o banco preenche ao publicar. */
export type LegalContent = Pick<LegalDocument, "title" | "summary" | "sections">;

/** Documento no ar com os dados do controlador que ele exibe e a impressão digital que o checkout grava. */
export interface PublishedLegalDocument {
  document: LegalDocument;
  controller: LegalController;
  sha256: string;
}

export type LegalLibrary = Record<LegalDocumentSlug, PublishedLegalDocument>;

export interface LegalPublishInput {
  documents: Record<LegalDocumentSlug, LegalContent>;
  controller: LegalController;
  /** Vai para o histórico de versões do documento. */
  note: string;
}

export const LEGAL_LIMITS = {
  title: 200,
  summary: 2000,
  sectionTitle: 200,
  sectionText: 20000,
  sections: 40,
  controllerField: 300,
  noteMin: 3,
  note: 240,
} as const;

/** Seção como o painel mostra: um título e um texto corrido com marcações simples. */
export interface LegalSectionDraft {
  /** Âncora da seção no site (#controlador). Vazia: sai do título ao publicar. */
  id: string;
  title: string;
  text: string;
}

export interface LegalDocumentDraft {
  title: string;
  summary: string;
  sections: LegalSectionDraft[];
}

const LIST_PREFIX = "- ";
const NOTE_PREFIX = "! ";
const DEFS_SEPARATOR = " | ";

function blockToText(block: LegalBlock): string {
  switch (block.type) {
    case "p":
      return block.text;
    case "note":
      return `${NOTE_PREFIX}${block.text}`;
    case "list":
      return block.items.map((item) => `${LIST_PREFIX}${item}`).join("\n");
    case "defs":
      return block.items.map((item) => `${item.term}${DEFS_SEPARATOR}${item.text}`).join("\n");
  }
}

const joinLines = (lines: string[]) => lines.join(" ").replace(/\s+/g, " ").trim();

function textToBlock(chunk: string): LegalBlock {
  const lines = chunk.split("\n").map((line) => line.trim()).filter(Boolean);
  if (lines.every((line) => line.startsWith(LIST_PREFIX))) {
    return { type: "list", items: lines.map((line) => line.slice(LIST_PREFIX.length).trim()) };
  }
  if (lines.every((line) => line.includes(DEFS_SEPARATOR))) {
    return {
      type: "defs",
      items: lines.map((line) => {
        const at = line.indexOf(DEFS_SEPARATOR);
        return { term: line.slice(0, at).trim(), text: line.slice(at + DEFS_SEPARATOR.length).trim() };
      }),
    };
  }
  if (lines[0]?.startsWith(NOTE_PREFIX)) {
    return { type: "note", text: joinLines([lines[0].slice(NOTE_PREFIX.length), ...lines.slice(1)]) };
  }
  return { type: "p", text: joinLines(lines) };
}

/** Texto da seção: um bloco por parágrafo, separados por uma linha em branco. */
export const blocksToText = (blocks: LegalBlock[]): string => blocks.map(blockToText).join("\n\n");

export function textToBlocks(text: string): LegalBlock[] {
  return text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map(textToBlock)
    .filter((block) => (block.type === "p" || block.type === "note" ? block.text.length > 0 : block.items.length > 0));
}

export const toDraft = (content: LegalContent): LegalDocumentDraft => ({
  title: content.title,
  summary: content.summary,
  sections: content.sections.map((section) => ({ id: section.id, title: section.title, text: blocksToText(section.blocks) })),
});

/** "1. Quem cuida dos seus dados" vira "quem-cuida-dos-seus-dados". */
export function sectionIdOf(title: string): string {
  const slug = title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^\d+[.)]?\s*/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
    .replace(/-+$/, "");
  return slug || "secao";
}

/** Âncoras únicas: a seção que já tinha a sua mantém, a nova ganha uma do título. */
function uniqueIds(sections: LegalSectionDraft[]): string[] {
  const used = new Set<string>();
  return sections.map((section) => {
    const base = section.id || sectionIdOf(section.title);
    let id = base;
    for (let suffix = 2; used.has(id); suffix += 1) id = `${base}-${suffix}`;
    used.add(id);
    return id;
  });
}

export function fromDraft(draft: LegalDocumentDraft): LegalContent {
  const ids = uniqueIds(draft.sections);
  const sections: LegalSection[] = draft.sections.map((section, index) => ({
    id: ids[index] ?? sectionIdOf(section.title),
    title: section.title.trim(),
    blocks: textToBlocks(section.text),
  }));
  return { title: draft.title.trim(), summary: joinLines(draft.summary.split("\n")), sections };
}

const contentOf = ({ title, summary, sections }: LegalContent): LegalContent => ({ title, summary, sections });

export const sameLegalContent = (a: LegalContent, b: LegalContent): boolean => JSON.stringify(contentOf(a)) === JSON.stringify(contentOf(b));

export const sameController = (a: LegalController, b: LegalController): boolean =>
  (Object.keys(a) as (keyof LegalController)[]).every((field) => (a[field] ?? null) === (b[field] ?? null));

/** 1.1.0 vira 1.2.0: cada publicação pelo painel é uma versão nova. */
export function nextLegalVersion(current: string | null): string {
  if (!current) return "1.0.0";
  const [major = "1", minor = "0"] = current.split(".");
  return `${Number(major)}.${Number(minor) + 1}.0`;
}
