import { ExternalLink, FlaskConical, ImageIcon, LogOut, Package, Receipt } from "lucide-react";
import { Suspense, useEffect } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { container } from "@/app/container";
import { Logo } from "@/ui/components/Logo";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "./components/AdminUi";
import { AdminSessionProvider, useAdminSession } from "./session";

const NAV_ITEMS = [
  { to: "/admin/contas", label: "Contas", icon: Package },
  { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon },
  { to: "/admin/pedidos", label: "Pedidos", icon: Receipt },
] as const;

/** O painel não deve aparecer no Google. */
function useNoIndex() {
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    const previousTitle = document.title;
    document.title = "Painel | Jota Digitais";
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
      <p className="mx-auto flex max-w-6xl items-start gap-2 px-4 py-2.5 text-xs leading-relaxed text-pink sm:items-center sm:px-6">
        <FlaskConical aria-hidden className="mt-0.5 size-4 shrink-0 sm:mt-0" />
        Modo demonstração: o banco ainda não foi conectado. Tudo que você salvar fica só neste navegador e já aparece no
        site aberto nele.
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
          <Link to="/admin/contas" aria-label="Painel, início" className="rounded-md">
            <Logo />
          </Link>
          <span className="rounded-full border border-line-strong px-2.5 py-0.5 text-[0.7rem] font-semibold text-fog">
            Painel
          </span>
        </div>

        <nav aria-label="Painel" className="hidden items-center gap-1 md:flex">
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
            className="hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm text-mist hover:text-white sm:flex"
          >
            Ver site <ExternalLink aria-hidden className="size-3.5" />
          </a>
          <span className="hidden max-w-[12rem] truncate px-2 text-xs text-mist lg:block" title={email}>
            {email}
          </span>
          <button
            type="button"
            onClick={() => void signOut()}
            className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm text-mist hover:bg-white/[0.06] hover:text-white"
          >
            <LogOut aria-hidden className="size-4" />
            <span className="max-sm:sr-only">Sair</span>
          </button>
        </div>
      </div>

      <nav aria-label="Painel" className="grid grid-cols-3 border-t border-line md:hidden">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                "flex items-center justify-center gap-1.5 py-2.5 text-[0.8rem] font-medium transition-colors",
                isActive ? "border-b-2 border-electric text-white" : "border-b-2 border-transparent text-mist",
              )
            }
          >
            <Icon aria-hidden className="size-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </header>
  );
}

/** Rotas do painel que exigem login de administrador. */
export function AdminProtected() {
  const { state } = useAdminSession();
  const location = useLocation();

  if (state.status === "loading") return <LoadingBlock label="Verificando acesso" />;
  if (state.status === "signed-out") return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;

  return (
    <>
      <TopBar email={state.session.email} />
      <DemoBanner />
      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <Suspense fallback={<LoadingBlock />}>
          <Outlet />
        </Suspense>
      </main>
    </>
  );
}

export function AdminRoot() {
  useNoIndex();
  return (
    <AdminSessionProvider>
      <div className="min-h-screen bg-ink">
        <Suspense fallback={<LoadingBlock />}>
          <Outlet />
        </Suspense>
      </div>
    </AdminSessionProvider>
  );
}
