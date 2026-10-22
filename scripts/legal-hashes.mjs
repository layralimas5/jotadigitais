// Imprime versão e hash dos documentos legais, para registrar em supabase/migrations quando eles mudarem.
// Uso: node scripts/legal-hashes.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { legalDocumentHash } from "../src/domain/legal/hash.ts";

const LEGAL_DIR = fileURLToPath(new URL("../src/domain/legal/", import.meta.url));
const readJson = (name) => JSON.parse(readFileSync(`${LEGAL_DIR}${name}`, "utf8"));

export async function currentLegalDocuments() {
  const controller = readJson("controller.json");
  const documents = [readJson("terms-of-use.json"), readJson("privacy-policy.json")];
  return Promise.all(
    documents.map(async (document) => ({
      slug: document.slug,
      version: document.version,
      sha256: await legalDocumentHash(document, controller),
    })),
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const rows = await currentLegalDocuments();
  const values = rows.map((row) => `  ('${row.slug}', '${row.version}', '${row.sha256}')`).join(",\n");
  console.log(`insert into public.legal_documents (slug, version, sha256) values\n${values};`);
}
