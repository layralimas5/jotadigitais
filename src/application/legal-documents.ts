import controllerJson from "@/domain/legal/controller.json";
import { legalDocumentHash } from "@/domain/legal/hash";
import type { LegalConsent, LegalController, LegalDocument, LegalDocumentSlug } from "@/domain/legal/legal-document";
import privacyJson from "@/domain/legal/privacy-policy.json";
import termsJson from "@/domain/legal/terms-of-use.json";
import { legalControllerSchema, legalDocumentSchema } from "./schemas";

// O hash sai do JSON cru, exatamente como scripts/legal-hashes.mjs calcula para a migration.
const RAW_DOCUMENTS: Record<LegalDocumentSlug, unknown> = { terms: termsJson, privacy: privacyJson };

export const LEGAL_CONTROLLER: LegalController = legalControllerSchema.parse(controllerJson);

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument> = {
  terms: legalDocumentSchema.parse(termsJson),
  privacy: legalDocumentSchema.parse(privacyJson),
};

let consents: Promise<LegalConsent[]> | null = null;

/** Versão e hash dos dois documentos que estão no ar: é o que o checkout grava como aceite. */
export function currentLegalConsents(): Promise<LegalConsent[]> {
  consents ??= Promise.all(
    (Object.keys(RAW_DOCUMENTS) as LegalDocumentSlug[]).map(async (slug) => ({
      slug,
      version: LEGAL_DOCUMENTS[slug].version,
      sha256: await legalDocumentHash(RAW_DOCUMENTS[slug], controllerJson),
    })),
  );
  return consents;
}
