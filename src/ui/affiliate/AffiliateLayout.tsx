import { House, LogOut, Megaphone, ReceiptText, UserRound, type LucideIcon } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { Link, Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { AFFILIATE_STATUS_MESSAGE } from "@/domain/affiliate";
import { Button, ButtonLink } from "@/ui/components/Button";
import { Logo } from "@/ui/components/Logo";
import { cn } from "@/ui/lib/cn";
import { AffiliateSessionProvider, useAffiliateSession } from "./session";

export const AFFILIATE_LOGIN_PATH = "/afiliado/entrar";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

const NAV: readonly NavItem[] = [
  { to: "/afiliado", label: "Início", icon: House, end: true },
  { to: "/afiliado/divulgar", label: "Divulgar", icon: Megaphone },
  { to: "/afiliado/extrato", label: "Extrato", icon: ReceiptText },
  { to: "/afiliado/perfil", label: "Perfil", icon: UserRound },
];

export function AffiliateSpinner({ label = "Carregando" }: { label?: string }) {
  return (
    <div role="status" className="grid min-h-[40vh] place-items-center">
      <span className="flex items-center gap-3 text-sm text-mist">
        <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-electric border-t-transparent motion-reduce:animate-none" />
        {label}
      </span>
    </div>
  );
}

/** Raiz de /afiliado: sessão própria do afiliado, separada da sessão do painel da loja. */
export function AffiliateRoot() {
  return (
    <AffiliateSessionProvider>
      <Suspense fallback={<AffiliateSpinner />}>
        <Outlet />
      </Suspense>
    </AffiliateSessionProvider>
  );
}

function CenteredCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <main id="conteudo" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6 text-center sm:p-8">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <h1 className="mt-6 font-display text-xl font-semibold text-white">{title}</h1>
        <div className="mt-3 space-y-5 text-sm text-fog">{children}</div>
      </div>
    </main>
  );
}

function StatusBanner({ status }: { status: keyof typeof AFFILIATE_STATUS_MESSAGE }) {
  return (
    <p role="status" className="rounded-2xl border border-amber-400/30 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-100">
      {AFFILIATE_STATUS_MESSAGE[status]}
    </p>
  );
}

/** Telas do afiliado logado: menu no topo (computador) ou embaixo (celular). */
export function AffiliateProtected() {
  const { state, refresh, signOut } = useAffiliateSession();
  const location = useLocation();

  if (state.status === "loading") return <AffiliateSpinner label="Abrindo o seu painel" />;
  if (state.status === "error") {
    return (
      <CenteredCard title="Não deu para abrir">
        <p>{state.message}</p>
        <Button onClick={refresh}>Tentar de novo</Button>
      </CenteredCard>
    );
  }
  if (state.status === "signed-out") return <Navigate to={AFFILIATE_LOGIN_PATH} replace state={{ from: location.pathname }} />;
  if (!state.me) {
    return (
      <CenteredCard title="Este login não é de afiliado">
        <p>O e-mail {state.email} não tem cadastro no programa de afiliados.</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <ButtonLink to="/seja-afiliado" variant="secondary">
            Quero me cadastrar
          </ButtonLink>
          <Button variant="ghost" onClick={() => void signOut()}>
            Sair
          </Button>
        </div>
      </CenteredCard>
    );
  }

  const { me } = state;
  const firstName = me.name.split(" ")[0] ?? me.name;

  return (
    <div className="min-h-screen pb-24 md:pb-10">
      <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link to="/" aria-label="Ir para a loja" className="shrink-0">
            <Logo size="sm" />
          </Link>
          <nav aria-label="Painel do afiliado" className="hidden md:block">
            <ul className="flex gap-1">
              {NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    className={({ isActive }) =>
                      cn(
                        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-electric",
                        isActive ? "bg-white/[0.08] text-white" : "text-mist hover:text-white",
                      )
                    }
                  >
                    <item.icon aria-hidden className="size-4" /> {item.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-fog sm:inline">Olá, {firstName}</span>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sair do painel"
              className="grid size-10 place-items-center rounded-full text-mist transition-colors hover:bg-white/[0.06] hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
            >
              <LogOut aria-hidden className="size-5" />
            </button>
          </div>
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-6xl space-y-6 px-4 pt-6 sm:px-6 sm:pt-8">
        {me.status !== "approved" && <StatusBanner status={me.status} />}
        <Suspense fallback={<AffiliateSpinner />}>
          <Outlet />
        </Suspense>
      </main>

      <nav aria-label="Painel do afiliado" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-electric",
                    isActive ? "text-white" : "text-mist",
                  )
                }
              >
                <item.icon aria-hidden className="size-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
