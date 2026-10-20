/** Entrega um arquivo JSON para o navegador salvar, sem passar por servidor. */
export function downloadJson(fileName: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Alguns navegadores ainda leem o endereço logo depois do clique.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
