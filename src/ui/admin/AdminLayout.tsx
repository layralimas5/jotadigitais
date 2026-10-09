import { motion, useReducedMotion } from "framer-motion";
import { ExternalLink, FlaskConical, ImageIcon, LogOut, Package, Receipt } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation, useMatch } from "react-router-dom";
import { container } from "@/app/container";
import { Logo } from "@/ui/components/Logo";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "./components/AdminUi";
import { AdminSessionProvider, useAdminSession } from "./session";
import { ToastProvider } from "./toast";

const NAV_ITEMS = [
  { to: "/admin/contas", label: "Contas", icon: Package },
  { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon },
  { to: "/admin/pedidos", label: "Pedidos", icon: Receipt },
] as const;

const REQUIRES_LOGIN = container.mode === "supabase";

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

function DemoBanner() {
  if (container.mode !== "demo") return null;
  return (
    <div className="border-b border-pink/25 bg-pink/10">
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2 text-xs leading-relaxed text-pink sm:items-center sm:px-6">
        <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        Modo demonstração: o que você salvar fica neste navegador e já aparece no site aberto nele.
      </p>
    </div>
  );
}

function TopBar({ email }: { email: string }) {
  const { signOut } = useAdminSession();
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:h-16 sm:px-6">
        <div className="flex items-center gap-3">
          <Link to="/admin/contas" aria-label="Sistema, início" className="rounded-md">
            <Logo />
          </Link>
          <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[0.7rem] font-semibold text-fog">
            Sistema
          </span>
        </div>

        <nav aria-label="Sistema" className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors",
                  isActive ? "bg-white/[0.08] text-white" : "text-mist hover:text-white",
                )
              }
            >
              <Icon aria-hidden className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-1">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-mist transition-colors hover:bg-white/[0.06] hover:text-white"
          >
            Ver site <ExternalLink aria-hidden className="size-3.5" />
          </a>
          {REQUIRES_LOGIN && (
            <>
              <span className="hidden max-w-[12rem] truncate px-2 text-xs text-mist lg:block" title={email}>
                {email}
              </span>
              <button
                type="button"
                onClick={() => void signOut()}
                aria-label="Sair"
                className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-mist hover:bg-white/[0.06] hover:text-white"
              >
                <LogOut aria-hidden className="size-4" />
                <span className="max-sm:hidden">Sair</span>
              </button>
            </>
          )}
        </div>
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
      <div className="grid grid-cols-3 px-2 py-1.5">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
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

/** Formulários de cadastro têm a própria barra fixa de salvar no celular; ali a navegação sai do caminho. */
function useIsEditing(): boolean {
  const account = useMatch("/admin/contas/:id");
  const testimonial = useMatch("/admin/depoimentos/:id");
  return Boolean(account ?? testimonial);
}

/** Rotas do sistema. Com o Supabase ligado, exigem login de administrador. */
export function AdminProtected() {
  const { state } = useAdminSession();
  const location = useLocation();
  const editing = useIsEditing();

  if (state.status === "loading") return <LoadingBlock label="Abrindo o sistema" />;
  if (state.status === "signed-out") return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <TopBar email={state.session.email} />
      <DemoBanner />
      <main id="conteudo" className="mx-auto max-w-6xl px-4 pt-5 pb-32 sm:px-6 md:pt-10 md:pb-16">
        <Suspense fallback={<LoadingBlock />}>
          <Outlet />
        </Suspense>
      </main>
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
