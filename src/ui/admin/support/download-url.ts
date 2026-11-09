/**
 * Link que baixa o anexo em vez de abrir. O atributo `download` do <a> não vale para arquivo de outro domínio
 * (o Storage do Supabase), então o link assinado ganha `download=<nome>` e o Supabase responde como anexo.
 * Arquivos do modo demo (blob:/data:) são do próprio site e baixam pelo atributo.
 */
export function downloadUrlOf(url: string, name: string): string {
  if (!/^https?:/i.test(url)) return url;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}download=${encodeURIComponent(name)}`;
}
