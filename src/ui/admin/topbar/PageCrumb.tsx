import { useLocation } from "react-router-dom";
import { PanelCrumb } from "@/ui/components/panel-shell/PanelShell";
import { NAV_GROUPS } from "../navigation";

interface Crumb {
  section: string;
  page: string;
}

/** Telas fora do menu lateral que também merecem nome no topo. */
const EXTRA_PAGES: readonly { to: string; crumb: Crumb }[] = [
  { to: "/admin/mais", crumb: { section: "Painel", page: "Mais" } },
];

const matches = (pathname: string, to: string) => pathname === to || pathname.startsWith(`${to}/`);

function crumbOf(pathname: string): Crumb | null {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((entry) => matches(pathname, entry.to));
    if (item) return { section: group.label ?? "Painel", page: item.label };
  }
  return EXTRA_PAGES.find((entry) => matches(pathname, entry.to))?.crumb ?? null;
}

/** "Vendas › Financeiro": mostra onde a pessoa está e ocupa o lado esquerdo do topo. */
export function PageCrumb() {
  const { pathname } = useLocation();
  const crumb = crumbOf(pathname);
  if (!crumb) return null;
  return <PanelCrumb section={crumb.section} page={crumb.page} />;
}
