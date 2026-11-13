/**
 * Turns a base64 data URL into a Blob without `fetch`: the site's CSP (connect-src) blocks `fetch("data:...")`
 * in production, so decoding has to happen in memory.
 */
export function blobFromDataUrl(dataUrl: string): Blob {
  const match = dataUrl.match(/^data:([^;,]+);base64,(.*)$/s);
  if (!match?.[1] || match[2] === undefined) throw new Error("Imagem em formato inesperado.");
  const binary = atob(match[2]);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type: match[1] });
}
