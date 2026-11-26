import { ArrowLeft, Ellipsis, ExternalLink, Eye, LogOut, Store, UserRound } from "lucide-react";
import { Suspense, type ReactNode } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { AFFILIATE_STATUS_MESSAGE, type AffiliateMe } from "@/domain/affiliate";
import { AffiliateStatusBadge } from "@/ui/components/affiliate/AffiliateBadges";
import { Button, ButtonLink } from "@/ui/components/Button";
import { Logo, LogoMark } from "@/ui/components/Logo";
import { PanelBottomNav, PanelCrumb, PanelSidebar, type PanelNavGroup } from "@/ui/components/panel-shell/PanelShell";
import { PanelUserMenu, type PanelMenuItem } from "@/ui/components/panel-shell/PanelUserMenu";
import { useSidebarCollapsed } from "@/ui/components/panel-shell/useSidebarCollapsed";
import { useMediaQuery } from "@/ui/hooks/useMediaQuery";
import { cn } from "@/ui/lib/cn";
import { NoticesBell } from "./components/NoticesBell";
import { AFFILIATE_BOTTOM_NAV, AFFILIATE_MORE_ITEMS, AFFILIATE_NAV_GROUPS, affiliateCrumbOf } from "./navigation";
import { AffiliateSessionProvider, useAffiliatePath, useAffiliateSession } from "./session";

export const AFFILIATE_LOGIN_PATH = "/afiliado/entrar";

/** A escolha de menu encolhido do afiliado fica separada da do painel da loja (pode ser o mesmo navegador). */
const SIDEBAR_KEY = "jota:affiliate-sidebar-collapsed";

/** Mesmo ponto do `md:` do Tailwind, onde o menu lateral aparece. */
const DESKTOP_QUERY = "(min-width: 48rem)";

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

/** Faixa da visualização pela equipe: de quem é o painel, que nada é salvo e o caminho de volta. */
function PreviewBar({ name, backPath }: { name: string; backPath: string }) {
  return (
    <div role="status" className="bg-violet text-white">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm sm:px-6 md:px-8">
        <span className="flex min-w-0 items-center gap-2">
          <Eye aria-hidden className="size-4 shrink-0" />
          <span className="min-w-0">
            Vendo como <strong>{name}</strong>. Só leitura, dados pessoais mascarados.
          </span>
        </span>
        <Link to={backPath} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 font-medium hover:bg-white/25">
          <ArrowLeft aria-hidden className="size-4" /> Voltar ao meu painel
        </Link>
      </div>
    </div>
  );
}

/** Logo e o nome do painel ("Afiliado"), como o "Sistema" do painel da loja. */
function AffiliateBrand({ home, stacked = false }: { home: string; stacked?: boolean }) {
  return (
    <Link to={home} aria-label="Painel do afiliado, início" className={cn("flex min-w-0 rounded-md", stacked ? "flex-col items-center gap-2" : "items-center gap-3")}>
      <Logo />
      <span
        className={cn(
          "flex items-center gap-1.5 font-display text-[0.7rem] font-semibold tracking-[0.2em] text-mist uppercase",
          !stacked && "max-[400px]:hidden",
        )}
      >
        <Store aria-hidden className="size-3.5 text-electric" />
        Afiliado
      </span>
    </Link>
  );
}

function StoreLink({ iconOnly }: { iconOnly: boolean }) {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      title={iconOnly ? "Ver a loja" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:bg-white/[0.06] hover:text-white",
        iconOnly && "justify-center px-0",
      )}
    >
      <ExternalLink aria-hidden className="size-4" /> <span className={iconOnly ? "sr-only" : undefined}>Ver a loja</span>
    </a>
  );
}

/** Menu da conta: perfil, loja e sair (na visualização pela equipe não tem sair). */
function AffiliateUserMenu({ me }: { me: AffiliateMe }) {
  const { signOut, preview } = useAffiliateSession();
  const pathTo = useAffiliatePath();
  const items: PanelMenuItem[] = [
    { key: "profile", label: "Perfil", icon: UserRound, to: pathTo("perfil") },
    { key: "store", label: "Ver a loja", icon: ExternalLink, to: "/", external: true },
  ];
  if (!preview) items.push({ key: "sign-out", label: "Sair", icon: LogOut, danger: true, onSelect: () => void signOut() });
  return <PanelUserMenu name={me.name} email={me.email} badge={<span className="mt-2 block"><AffiliateStatusBadge status={me.status} /></span>} items={items} />;
}

/** Topo: no computador, onde você está à esquerda e avisos e conta à direita; no celular, a marca no lugar. */
function AffiliateTopBar({ me }: { me: AffiliateMe }) {
  const desktop = useMediaQuery(DESKTOP_QUERY);
  const pathTo = useAffiliatePath();
  const { pathname } = useLocation();
  const page = pathname.replace(pathTo(""), "").replace(/^\//, "").split("/")[0] ?? "";
  const crumb = affiliateCrumbOf(page);
  if (desktop) {
    return (
      <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
        <div className="flex h-16 items-center justify-between gap-6 px-8">
          <PanelCrumb section={crumb.section} page={crumb.page} />
          <div className="flex items-center gap-1">
            <NoticesBell />
            <AffiliateUserMenu me={me} />
          </div>
        </div>
      </header>
    );
  }
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <AffiliateBrand home={pathTo("")} />
        <div className="flex shrink-0 items-center">
          <NoticesBell />
          <AffiliateUserMenu me={me} />
        </div>
      </div>
    </header>
  );
}

/**
 * Telas do afiliado logado, na mesma casca do painel da loja: menu lateral em grupos (encolhe para os ícones),
 * topo com onde você está, sininho e conta, e no celular a barra de baixo com o "Mais".
 */
export function AffiliateProtected() {
  const { state, refresh, signOut, preview } = useAffiliateSession();
  const pathTo = useAffiliatePath();
  const location = useLocation();
  const sidebar = useSidebarCollapsed(false, SIDEBAR_KEY);

  if (state.status === "loading") return <AffiliateSpinner label="Abrindo o painel" />;
  if (state.status === "error") {
    return (
      <CenteredCard title="Não deu para abrir">
        <p>{state.message}</p>
        <Button onClick={refresh}>Tentar de novo</Button>
      </CenteredCard>
    );
  }
  if (state.status === "signed-out" || !state.me) {
    if (preview) {
      return (
        <CenteredCard title="Afiliado não encontrado">
          <p>Ele pode ter sido apagado.</p>
          <ButtonLink to={preview.backPath} variant="secondary">
            Voltar ao meu painel
          </ButtonLink>
        </CenteredCard>
      );
    }
    if (state.status === "signed-out") return <Navigate to={AFFILIATE_LOGIN_PATH} replace state={{ from: location.pathname }} />;
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
  const groups: PanelNavGroup[] = AFFILIATE_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.map((item) => ({ to: pathTo(item.page), label: item.label, icon: item.icon, end: item.page === "" })),
  }));
  const moreRoutes = [pathTo("mais"), ...AFFILIATE_MORE_ITEMS.map((item) => `${pathTo(item.page)}/*`)];
  const bottom = [
    ...AFFILIATE_BOTTOM_NAV.map((item) => ({ to: pathTo(item.page), label: item.label, icon: item.icon, end: item.page === "" })),
    { to: pathTo("mais"), label: "Mais", icon: Ellipsis, activeOn: moreRoutes },
  ];

  return (
    <div className="min-h-screen bg-ink">
      <PanelSidebar
        navLabel="Painel do afiliado"
        layoutId="affiliate-sidebar-active"
        collapsed={sidebar.collapsed}
        onToggle={sidebar.toggle}
        groups={groups}
        brand={<AffiliateBrand home={pathTo("")} stacked />}
        collapsedBrand={
          <Link to={pathTo("")} aria-label="Painel do afiliado, início" className="rounded-md">
            <LogoMark />
          </Link>
        }
        footer={(iconOnly) => <StoreLink iconOnly={iconOnly} />}
      />
      <div className="transition-[padding] duration-300 ease-out motion-reduce:transition-none md:pl-[var(--sidebar-w,15rem)]">
        {preview && <PreviewBar name={me.name} backPath={preview.backPath} />}
        <AffiliateTopBar me={me} />
        <main id="conteudo" className="mx-auto max-w-6xl space-y-6 px-4 pt-5 pb-32 sm:px-6 md:px-8 md:pt-8 md:pb-16">
          {me.status !== "approved" && <StatusBanner status={me.status} />}
          <Suspense fallback={<AffiliateSpinner />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <PanelBottomNav navLabel="Painel do afiliado" layoutId="affiliate-bottom-active" entries={bottom} />
    </div>
  );
}
