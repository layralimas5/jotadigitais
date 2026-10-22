// Sem imports de propósito: o script scripts/legal-hashes.mjs usa este mesmo arquivo no Node,
// então o hash gravado no banco e o calculado no checkout saem da mesma função.

/** SHA-256 do documento como está no JSON, junto com os dados do controlador que ele exibe. */
export async function legalDocumentHash(document: unknown, controller: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify({ document, controller }));
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
