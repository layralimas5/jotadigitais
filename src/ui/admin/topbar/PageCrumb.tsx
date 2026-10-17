import { ChevronRight } from "lucide-react";
import { useLocation } from "react-router-dom";
import { NAV_GROUPS } from "../navigation";

interface Crumb {
  section: string;
  page: string;
}

/** Telas fora do menu lateral que também merecem nome no topo. */
const EXTRA_PAGES: readonly { to: string; crumb: Crumb }[] = [
  { to: "/admin/minha-conta", crumb: { section: "Conta", page: "Minha conta" } },
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
  return (
    <nav aria-label="Você está em" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden shrink-0 text-mist xl:block">{crumb.section}</li>
        <li aria-hidden className="hidden shrink-0 text-line-strong xl:block">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="truncate font-medium text-white">
          {crumb.page}
        </li>
      </ol>
    </nav>
  );
}
