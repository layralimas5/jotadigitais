import { Navigate, useSearchParams } from "react-router-dom";
import { WHATSAPP_PATH } from "../whatsapp/links";

/** /admin/automacao virou abas de /admin/whatsapp. Links antigos (avisos, favoritos) caem na aba certa. */
export default function LegacyAutomationRedirect() {
  const [params] = useSearchParams();
  const next = new URLSearchParams(params);
  // A aba padrão da Automação era a entrega automática.
  if (!next.get("aba")) next.set("aba", "entrega");
  return <Navigate to={`${WHATSAPP_PATH}?${next.toString()}`} replace />;
}
