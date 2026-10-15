import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, ImageIcon, Package, Receipt, Settings, SquareKanban, Users } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, matchPath, useLocation } from "react-router-dom";
import { Logo } from "@/ui/components/Logo";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "./components/AdminUi";
import { UserMenu } from "./components/UserMenu";
import { AdminSessionProvider, useAdminSession } from "./session";
import { ToastProvider } from "./toast";

/** No celular, Configurações fica no menu do usuário para a barra de baixo caber no polegar. */
const NAV_ITEMS = [
  { to: "/admin/contas", label: "Contas", icon: Package, inBottomNav: true },
  { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon, inBottomNav: true },
  { to: "/admin/pedidos", label: "Pedidos", icon: Receipt, inBottomNav: true },
  { to: "/admin/clientes", label: "Clientes", icon: Users, inBottomNav: true },
  { to: "/admin/crm", label: "CRM", icon: SquareKanban, inBottomNav: true },
  { to: "/admin/configuracoes", label: "Configurações", icon: Settings, inBottomNav: false },
] as const;

const BOTTOM_NAV_ITEMS = NAV_ITEMS.filter((item) => item.inBottomNav);

/** Cadastros com a própria barra fixa de salvar no celular: ali a navegação de baixo sai do caminho. */
const EDITOR_ROUTES = ["/admin/contas/:id", "/admin/depoimentos/:id", "/admin/crm/:id"];

/** Telas de leitura e preenchimento: numa largura confortável em vez de esticadas até a borda. */
const FORM_ROUTES = [...EDITOR_ROUTES, "/admin/clientes/:key", "/admin/configuracoes", "/admin/minha-conta"];

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
      to="/admin/contas"
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
      <nav aria-label="Sistema" className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium">
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
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 backdrop-blur-xl md:hidden">
      <div className="flex h-14 items-center justify-between gap-3 px-4">
        <Brand />
        <div className="flex items-center gap-1">
          <SiteLink className="rounded-full" />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/** Barra do topo no tablet e no computador, com o menu do usuário à direita. */
function DesktopTopBar() {
  return (
    <header className="sticky top-0 z-30 hidden border-b border-line bg-ink/85 backdrop-blur-xl md:block">
      <div className="flex h-16 items-center justify-end px-8">
        <UserMenu />
      </div>
    </header>
  );
}

/** Navegação no polegar: fixa embaixo no celular, com a aba ativa deslizando entre os itens. */
function BottomNav() {
  const reduceMotion = useReducedMotion();
  return (
    <nav
      aria-label="Sistema"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="grid grid-cols-5 px-1 py-1.5">
        {BOTTOM_NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className="relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.7rem] font-medium">
            {({ isActive }) => (
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
            )}
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
  const editing = matchesAny(EDITOR_ROUTES, location.pathname);
  const formPage = matchesAny(FORM_ROUTES, location.pathname);

  if (state.status === "loading") return <LoadingBlock label="Abrindo o sistema" />;
  if (state.status === "signed-out") return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <Sidebar />
      <div className="md:pl-60">
        <MobileTopBar />
        <DesktopTopBar />
        <main
          id="conteudo"
          className={cn("px-4 pt-5 pb-32 sm:px-6 md:px-8 md:pt-8 md:pb-16", formPage && "md:max-w-[68rem]")}
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
