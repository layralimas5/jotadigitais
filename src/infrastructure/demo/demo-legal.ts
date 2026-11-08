import type { AdminLegalDocumentRepository } from "@/application/ports";
import controllerJson from "@/domain/legal/controller.json";
import { legalDocumentHash } from "@/domain/legal/hash";
import { LEGAL_DOCUMENT_SLUGS, type LegalController, type LegalDocument, type LegalDocumentSlug } from "@/domain/legal/legal-document";
import { nextLegalVersion, sameController, sameLegalContent, type LegalPublishInput } from "@/domain/legal/legal-editing";
import privacyJson from "@/domain/legal/privacy-policy.json";
import termsJson from "@/domain/legal/terms-of-use.json";
import { simulateLatency, type DemoDatabase, type DemoLegalDocumentRow } from "./demo-database";

const BUNDLED: Record<LegalDocumentSlug, unknown> = { terms: termsJson, privacy: privacyJson };

const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });

/** Como as migrations deixam o banco: a versão do código, com a mesma impressão digital. */
async function seedRows(): Promise<DemoLegalDocumentRow[]> {
  return Promise.all(
    LEGAL_DOCUMENT_SLUGS.map(async (slug) => {
      const content = BUNDLED[slug] as LegalDocument;
      return {
        slug,
        version: content.version,
        sha256: await legalDocumentHash(BUNDLED[slug], controllerJson),
        publishedAt: `${content.effectiveDate}T12:00:00.000Z`,
        content,
        controller: controllerJson as LegalController,
      };
    }),
  );
}

const latestOf = (rows: DemoLegalDocumentRow[], slug: LegalDocumentSlug) =>
  rows.filter((row) => row.slug === slug).sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))[0];

/** Termos e Política no navegador, com as mesmas regras de publish_legal_documents. */
export class DemoLegalDocumentRepository implements AdminLegalDocumentRepository {
  constructor(private readonly db: DemoDatabase) {}

  private async rows(): Promise<DemoLegalDocumentRow[]> {
    const stored = this.db.read().legalDocuments;
    if (stored?.length) return stored;
    const seeded = await seedRows();
    this.db.write((state) => {
      state.legalDocuments ??= seeded;
    });
    return seeded;
  }

  async listCurrent(): Promise<unknown[]> {
    const rows = await this.rows();
    return LEGAL_DOCUMENT_SLUGS.map((slug) => latestOf(rows, slug))
      .filter((row) => row !== undefined)
      .map((row) => ({ slug: row.slug, version: row.version, sha256: row.sha256, content: row.content, controller: row.controller }));
  }

  async publish(input: LegalPublishInput): Promise<void> {
    await simulateLatency();
    const rows = await this.rows();
    const date = today();
    const published: DemoLegalDocumentRow[] = [];
    for (const slug of LEGAL_DOCUMENT_SLUGS) {
      const current = latestOf(rows, slug);
      const next = input.documents[slug];
      if (current && sameLegalContent(current.content, next) && sameController(current.controller, input.controller)) continue;
      const version = nextLegalVersion(current?.version ?? null);
      const content: LegalDocument = {
        slug,
        version,
        effectiveDate: date,
        ...next,
        history: [{ version, date, summary: input.note }, ...(current?.content.history ?? [])],
      };
      published.push({
        slug,
        version,
        sha256: await legalDocumentHash(content, input.controller),
        publishedAt: new Date().toISOString(),
        content,
        controller: input.controller,
      });
    }
    if (published.length === 0) return;
    this.db.write((state) => {
      state.legalDocuments = [...(state.legalDocuments ?? rows), ...published];
    });
  }
}
