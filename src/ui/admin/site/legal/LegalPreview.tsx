import type { LegalDocument, LegalDocumentSlug } from "@/domain/legal/legal-document";
import { fromDraft, nextLegalVersion, type LegalLibrary } from "@/domain/legal/legal-editing";
import { LegalDocumentView } from "@/ui/components/legal/LegalDocumentView";
import { controllerOf, OTHER_SLUG, type LegalDraftState } from "./legal-draft";

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** O rascunho como o cliente vai ler, com o número e a data da versão que vai ser publicada. */
export function LegalPreview({ slug, library, draft }: { slug: LegalDocumentSlug; library: LegalLibrary; draft: LegalDraftState }) {
  const current = library[slug].document;
  const version = nextLegalVersion(current.version);
  const content = fromDraft(draft.document);
  const document: LegalDocument = {
    ...current,
    ...content,
    sections: content.sections.filter((section) => section.blocks.length > 0),
    version,
    effectiveDate: today(),
    history: [{ version, date: today(), summary: draft.note.trim() || "O que mudou nesta versão" }, ...current.history],
  };
  return (
    <section aria-label="Prévia do documento" className="max-h-[70vh] overflow-y-auto overscroll-contain rounded-3xl border border-line-strong bg-ink py-8">
      <LegalDocumentView document={document} controller={controllerOf(draft.controller)} other={library[OTHER_SLUG[slug]].document} />
    </section>
  );
}
