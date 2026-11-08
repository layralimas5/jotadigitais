import controllerJson from "@/domain/legal/controller.json";
import type { LegalConsent, LegalController, LegalDocument, LegalDocumentSlug } from "@/domain/legal/legal-document";
import { LEGAL_DOCUMENT_SLUGS } from "@/domain/legal/legal-document";
import type { LegalLibrary, PublishedLegalDocument } from "@/domain/legal/legal-editing";
import privacyJson from "@/domain/legal/privacy-policy.json";
import termsJson from "@/domain/legal/terms-of-use.json";
import type { LegalDocumentRepository } from "./ports";
import { legalControllerSchema, legalDocumentRowSchema, legalDocumentSchema } from "./schemas";

/** Texto original, que acompanha o código: vale até o banco responder e se o que veio de lá não passar na validação. */
export const LEGAL_CONTROLLER: LegalController = legalControllerSchema.parse(controllerJson);

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument> = {
  terms: legalDocumentSchema.parse(termsJson),
  privacy: legalDocumentSchema.parse(privacyJson),
};

/** Sem impressão digital: serve para mostrar, nunca para gravar aceite. */
export const BUNDLED_LEGAL_LIBRARY: LegalLibrary = {
  terms: { document: LEGAL_DOCUMENTS.terms, controller: LEGAL_CONTROLLER, sha256: "" },
  privacy: { document: LEGAL_DOCUMENTS.privacy, controller: LEGAL_CONTROLLER, sha256: "" },
};

function publishedFrom(raw: unknown, slug: LegalDocumentSlug): PublishedLegalDocument | null {
  const row = legalDocumentRowSchema.safeParse(raw);
  if (!row.success || row.data.slug !== slug) return null;
  const document = legalDocumentSchema.safeParse(row.data.content);
  const controller = legalControllerSchema.safeParse(row.data.controller);
  if (document.success && controller.success && document.data.slug === slug && document.data.version === row.data.version) {
    return { document: document.data, controller: controller.data, sha256: row.data.sha256 };
  }
  console.error(`Documento legal ${slug} ${row.data.version} no banco não passou na validação; vale o texto original.`);
  return { ...BUNDLED_LEGAL_LIBRARY[slug], sha256: row.data.sha256 };
}

/** Termos e Política no ar: o que foi publicado pelo painel por último. */
export async function loadLegalLibrary(deps: { legal: LegalDocumentRepository }): Promise<LegalLibrary> {
  const rows = await deps.legal.listCurrent();
  const library = { ...BUNDLED_LEGAL_LIBRARY };
  for (const slug of LEGAL_DOCUMENT_SLUGS) {
    const raw = rows.find((row) => typeof row === "object" && row !== null && (row as { slug?: unknown }).slug === slug);
    const published = raw === undefined ? null : publishedFrom(raw, slug);
    if (published) library[slug] = published;
  }
  return library;
}

/** Versão e impressão digital dos dois documentos no ar: é o que o checkout grava como aceite. */
export async function currentLegalConsents(deps: { legal: LegalDocumentRepository }): Promise<LegalConsent[]> {
  const library = await loadLegalLibrary(deps);
  return LEGAL_DOCUMENT_SLUGS.map((slug) => {
    const { document, sha256 } = library[slug];
    if (!sha256) throw new Error(`Documento legal ${slug} sem versão publicada no banco.`);
    return { slug, version: document.version, sha256 };
  });
}
