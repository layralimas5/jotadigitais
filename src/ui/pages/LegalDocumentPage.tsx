import type { LegalDocumentSlug } from "@/domain/legal/legal-document";
import { LegalDocumentView } from "@/ui/components/legal/LegalDocumentView";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useLegalLibrary } from "@/ui/hooks/useLegalLibrary";

const OTHER: Record<LegalDocumentSlug, LegalDocumentSlug> = { terms: "privacy", privacy: "terms" };

export default function LegalDocumentPage({ slug }: { slug: LegalDocumentSlug }) {
  const library = useLegalLibrary();
  const { document, controller } = library[slug];
  useDocumentMeta(document.title, document.summary.replace(/\{\{\w+\}\}/g, "Jota Digitais").slice(0, 160));

  return (
    <div className="pt-28 pb-24 md:pt-36">
      <LegalDocumentView document={document} controller={controller} other={library[OTHER[slug]].document} />
    </div>
  );
}
