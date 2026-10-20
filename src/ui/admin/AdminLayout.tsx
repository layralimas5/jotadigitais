import { motion, useReducedMotion } from "framer-motion";
import { Ellipsis, ExternalLink, type LucideIcon } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, matchPath, useLocation } from "react-router-dom";
import { Logo } from "@/ui/components/Logo";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "./components/AdminUi";
import { UserMenu } from "./components/UserMenu";
import { GlobalSearch } from "./topbar/GlobalSearch";
import { MobileSearch } from "./topbar/MobileSearch";
import { NotificationBell } from "./topbar/NotificationBell";
import { PageCrumb } from "./topbar/PageCrumb";
import { useMediaQuery } from "@/ui/hooks/useMediaQuery";
import { BOTTOM_NAV_ITEMS, HOME_PATH, MORE_ITEMS, NAV_GROUPS } from "./navigation";
import { AdminSessionProvider, useAdminSession } from "./session";
import { ToastProvider } from "./toast";

/** Cadastros com a própria barra fixa de salvar no celular: ali a navegação de baixo sai do caminho. */
const EDITOR_ROUTES = [
  "/admin/contas/:id",
  "/admin/depoimentos/:id",
  "/admin/crm/:id",
  "/admin/clientes/novo",
  "/admin/clientes/cadastro/:id",
  "/admin/financeiro/despesas/:id",
  "/admin/financeiro/receitas/:id",
  "/admin/parceiros/:id",
  "/admin/usuarios/novo",
];

/** Editores largos (prévia ao lado): também têm barra própria no celular, mas usam a largura toda. */
const WIDE_EDITOR_ROUTES = ["/admin/site"];

/** Telas de leitura e preenchimento: centralizadas numa largura confortável em vez de esticadas até a borda. */
const FORM_ROUTES = [
  ...EDITOR_ROUTES,
  "/admin/clientes/:key",
  "/admin/automacao",
  "/admin/apis",
  "/admin/configuracoes",
];

const MORE_ROUTES = ["/admin/mais", ...MORE_ITEMS.map((item) => `${item.to}/*`)];

/** Mesmo ponto do `md:` do Tailwind, onde o menu lateral aparece. */
const DESKTOP_QUERY = "(min-width: 48rem)";

const matchesAny = (patterns: readonly string[], pathname: string) =>
  patterns.some((pattern) => matchPath(pattern, pathname) !== null);

/** O painel não deve aparecer no Google. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = "Sistema | Jota Digitais";
    return () => {
      meta.remove();
      document.title = previousTitle;
    };
  }, []);
}

function SiteLink({ className }: { className?: string }) {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:bg-white/[0.06] hover:text-white",
        className,
      )}
    >
      <ExternalLink aria-hidden className="size-4" /> <span className="max-sm:sr-only">Ver site</span>
    </a>
  );
}

/** Na barra lateral o nome "Sistema" fica centralizado embaixo do logo; no topo do celular, ao lado. */
function Brand({ stacked = false }: { stacked?: boolean }) {
  return (
    <Link
      to={HOME_PATH}
      aria-label="Sistema Jota Digitais, início"
      className={cn("flex rounded-md", stacked ? "flex-col items-center gap-2" : "items-center gap-3")}
    >
      <Logo />
      <span className="font-display text-[0.7rem] font-semibold tracking-[0.2em] text-mist uppercase">Sistema</span>
    </Link>
  );
}

/** Menu lateral fixo à esquerda, do tablet para cima. */
function Sidebar() {
  const reduceMotion = useReducedMotion();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-line bg-night md:flex">
      <div className="flex justify-center border-b border-line px-5 py-5">
        <Brand stacked />
      </div>
      <nav aria-label="Sistema" className="flex-1 space-y-5 overflow-y-auto p-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.label ?? "inicio"}>
            {group.label && (
              <p className="px-3 pb-1.5 text-[0.65rem] font-semibold tracking-[0.16em] text-mist/70 uppercase">{group.label}</p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <NavLink to={to} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium">
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active"
                            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                            className="absolute inset-0 rounded-xl border border-electric/30 bg-electric/10"
                          />
                        )}
                        <Icon aria-hidden className={cn("relative size-[1.1rem]", isActive ? "text-electric" : "text-mist")} />
                        <span className={cn("relative", isActive ? "text-white" : "text-mist hover:text-white")}>{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="border-t border-line p-3">
        <SiteLink />
      </div>
    </aside>
  );
}

/** Topo enxuto no celular: a navegação fica na barra de baixo. */
function MobileTopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Brand />
        <div className="flex items-center">
          <MobileSearch />
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/** Barra do topo no tablet e no computador: onde você está à esquerda, busca no centro, sininho e menu à direita. */
function DesktopTopBar() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_minmax(16rem,36rem)_minmax(auto,1fr)] items-center gap-6 px-8">
        <PageCrumb />
        <GlobalSearch withShortcut className="col-start-2 w-full" />
        <div className="flex items-center justify-self-end gap-1">
          <NotificationBell />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/** Só uma barra existe por vez: o sininho de cada uma consulta o servidor sozinho. */
function TopBar() {
  return useMediaQuery(DESKTOP_QUERY) ? <DesktopTopBar /> : <MobileTopBar />;
}

interface BottomNavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  /** "Mais" fica ativo também nas seções que moram dentro dele. */
  activeOn?: readonly string[];
}

const BOTTOM_NAV: readonly BottomNavEntry[] = [
  ...BOTTOM_NAV_ITEMS,
  { to: "/admin/mais", label: "Mais", icon: Ellipsis, activeOn: MORE_ROUTES },
];

/** Navegação no polegar: fixa embaixo no celular, com a aba ativa deslizando entre os itens. */
function BottomNav() {
  const reduceMotion = useReducedMotion();
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Sistema"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-5 px-1 py-1.5">
        {BOTTOM_NAV.map(({ to, label, icon: Icon, activeOn }) => (
          <NavLink key={to} to={to} className="relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.7rem] font-medium">
            {({ isActive: linkActive }) => {
              const isActive = activeOn ? matchesAny(activeOn, pathname) : linkActive;
              return (
              <>
                {isActive && (
                  <motion.span
                    layoutId="bottom-nav-active"
                    transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                    className="absolute inset-0 rounded-2xl bg-white/[0.08]"
                  />
                )}
                <Icon aria-hidden className={cn("relative size-5", isActive ? "text-electric" : "text-mist")} />
                <span className={cn("relative", isActive ? "text-white" : "text-mist")}>{label}</span>
              </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** Rotas do sistema. Com o Supabase ligado, exigem login de administrador. */
export function AdminProtected() {
  const { state } = useAdminSession();
  const location = useLocation();
  const editing = matchesAny([...EDITOR_ROUTES, ...WIDE_EDITOR_ROUTES], location.pathname);
  const formPage = matchesAny(FORM_ROUTES, location.pathname);

  if (state.status === "loading") return <LoadingBlock label="Abrindo o sistema" />;
  if (state.status === "signed-out") return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <Sidebar />
      <div className="md:pl-60">
        <TopBar />
        <main
          id="conteudo"
          className={cn("px-4 pt-5 pb-32 sm:px-6 md:px-8 md:pt-8 md:pb-16", formPage && "mx-auto md:max-w-[68rem]")}
        >
          <Suspense fallback={<LoadingBlock />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      {!editing && <BottomNav />}
    </>
  );
}

export function AdminRoot() {
  useNoIndex();
  return (
    <AdminSessionProvider>
      <ToastProvider>
        <div className="min-h-screen bg-ink">
          <Suspense fallback={<LoadingBlock />}>
            <Outlet />
          </Suspense>
        </div>
      </ToastProvider>
    </AdminSessionProvider>
  );
}
