import { Ellipsis, ExternalLink, MonitorCog } from "lucide-react";
import { Suspense, useEffect, useRef, useState } from "react";
import { PixReconciler } from "./PixReconciler";
import { Link, Navigate, Outlet, matchPath, useLocation } from "react-router-dom";
import { PanelBottomNav, PanelSidebar, type PanelBottomNavEntry, type PanelNavGroup } from "@/ui/components/panel-shell/PanelShell";
import { Logo, LogoMark } from "@/ui/components/Logo";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "./components/AdminUi";
import { UserMenu } from "./components/UserMenu";
import { GlobalSearch } from "./topbar/GlobalSearch";
import { MobileSearch } from "./topbar/MobileSearch";
import { NotificationBell } from "./topbar/NotificationBell";
import { PageCrumb } from "./topbar/PageCrumb";
import { useFixedViewport } from "@/ui/hooks/useFixedViewport";
import { useMediaQuery } from "@/ui/hooks/useMediaQuery";
import { canUseStoreArea, type StaffAccess } from "@/domain/admin-user";
import { supportRoleOf } from "@/domain/support-ticket";
import { bottomNavItemsFor, canOpen, fitsBottomNav, homePathFor, moreItemsFor, navGroupsFor, SUPPORT_PATH, WHATSAPP_PATH } from "./navigation";
import { AttentionCount, SupportAttentionProvider, useSupportAttention } from "./support/SupportAttention";
import { WhatsAppAttentionProvider, useWhatsAppAttention, whatsAppAttentionLabel } from "./whatsapp/WhatsAppAttention";
import { AdminViewProvider, useAdminView } from "./admin-view";
import { PreviewBanner, SidebarPreviewEntry } from "./preview/PreviewControls";
import { usePreviewSubmitGuard } from "./preview/usePreviewSubmitGuard";
import { usePanelApp } from "./pwa/usePanelApp";
import { AdminSessionProvider, useAdminSession } from "./session";
import { ToastProvider } from "./toast";
import { FocusLayoutProvider } from "./focus-layout";
import { useSidebarCollapsed } from "@/ui/components/panel-shell/useSidebarCollapsed";

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
  "/admin/usuarios/:id",
  "/admin/suporte/novo",
  "/admin/acessos/novo",
  "/admin/acessos/:id",
];

/** Editores largos (prévia ao lado): também têm barra própria no celular, mas usam a largura toda. */
const WIDE_EDITOR_ROUTES = ["/admin/site"];

/** Telas de leitura e preenchimento: centralizadas numa largura confortável em vez de esticadas até a borda. */
const FORM_ROUTES = [
  ...EDITOR_ROUTES,
  "/admin/clientes/:key",
  "/admin/apis",
  "/admin/configuracoes",
  "/admin/suporte/:id",
  "/admin/parceiros/afiliados/:id",
  "/admin/acessos/afiliados/:id",
];

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

function SiteLink({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  return (
    <a
      href="/"
      target="_blank"
      rel="noreferrer"
      title={iconOnly ? "Ver site" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-mist transition-colors hover:bg-white/[0.06] hover:text-white",
        iconOnly && "justify-center px-0",
        className,
      )}
    >
      <ExternalLink aria-hidden className="size-4" /> <span className={iconOnly ? "sr-only" : "max-sm:sr-only"}>Ver site</span>
    </a>
  );
}

/**
 * Na barra lateral o nome "Sistema" fica centralizado embaixo do logo; no topo do celular, ao lado.
 * Em celular estreito (até 400px) o nome sai: logo, busca, sininho e menu não cabem juntos.
 */
function Brand({ home, stacked = false }: { home: string; stacked?: boolean }) {
  return (
    <Link
      to={home}
      aria-label="Sistema Jota Digitais, início"
      className={cn("flex min-w-0 rounded-md", stacked ? "flex-col items-center gap-2" : "items-center gap-3")}
    >
      <Logo />
      <span
        className={cn(
          "flex items-center gap-1.5 font-display text-[0.7rem] font-semibold tracking-[0.2em] text-mist uppercase",
          !stacked && "max-[400px]:hidden",
        )}
      >
        <MonitorCog aria-hidden className="size-3.5 text-electric" />
        Sistema
      </span>
    </Link>
  );
}

interface SidebarProps {
  access: StaffAccess;
  /** A desenvolvedora tem o atalho para ver o painel como o Jota. */
  canPreview: boolean;
  collapsed: boolean;
  onToggle: () => void;
}

/** Menu lateral fixo à esquerda, do tablet para cima (a casca é a mesma do painel do afiliado). */
function Sidebar({ access, canPreview, collapsed, onToggle }: SidebarProps) {
  const attention = useSupportAttention();
  const whatsapp = useWhatsAppAttention();
  const groups: PanelNavGroup[] = navGroupsFor(access).map((group) => ({
    label: group.label ?? null,
    items: group.items.map(({ to, label, icon }) => {
      const count = to === SUPPORT_PATH ? attention : to === WHATSAPP_PATH ? whatsapp : 0;
      const countLabel = to === WHATSAPP_PATH ? whatsAppAttentionLabel(count) : undefined;
      return {
        to,
        label,
        icon,
        dot: count > 0,
        collapsedLabel: count > 0 ? `${label}, ${count} pendentes` : undefined,
        trailing: count > 0 ? <AttentionCount count={count} label={countLabel} className="relative ml-auto" /> : undefined,
      };
    }),
  }));
  return (
    <PanelSidebar
      navLabel="Sistema"
      collapsed={collapsed}
      onToggle={onToggle}
      groups={groups}
      collapsedBrand={
        <Link to={homePathFor(access)} aria-label="Sistema Jota Digitais, início" className="rounded-md">
          <LogoMark />
        </Link>
      }
      brand={<Brand home={homePathFor(access)} stacked />}
      footer={(iconOnly) => (
        <>
          {canPreview && <SidebarPreviewEntry iconOnly={iconOnly} />}
          <SiteLink iconOnly={iconOnly} />
        </>
      )}
    />
  );
}

/** Topo enxuto no celular: a navegação fica na barra de baixo. */
function MobileTopBar({ access }: { access: StaffAccess }) {
  const { search, bell } = topBarToolsOf(access);
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-black/85 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-2 px-4">
        <Brand home={homePathFor(access)} />
        <div className="flex shrink-0 items-center">
          {search && <MobileSearch />}
          {bell && <NotificationBell />}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/** Barra do topo no tablet e no computador: onde você está à esquerda, busca no centro, sininho e menu à direita. */
function DesktopTopBar({ access }: { access: StaffAccess }) {
  const { search, bell } = topBarToolsOf(access);
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-ink/85 backdrop-blur-xl">
      <div className="grid h-16 grid-cols-[minmax(0,1fr)_minmax(16rem,36rem)_minmax(auto,1fr)] items-center gap-6 px-8">
        <PageCrumb />
        {search && <GlobalSearch withShortcut className="col-start-2 w-full" />}
        <div className="col-start-3 flex items-center justify-self-end gap-1">
          {bell && <NotificationBell />}
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

/**
 * Busca e sininho mostram dados da loja: a busca (que cruza contas, pedidos e clientes) é só do Jota;
 * o sininho também aparece para o ajudante que cuida dos pedidos, só com os pedidos novos.
 */
function topBarToolsOf(access: StaffAccess): { search: boolean; bell: boolean } {
  return { search: access.role === "admin", bell: canUseStoreArea(access, "orders") };
}

/** Só uma barra existe por vez: o sininho de cada uma consulta o servidor sozinho. */
function TopBar({ access }: { access: StaffAccess }) {
  return useMediaQuery(DESKTOP_QUERY) ? <DesktopTopBar access={access} /> : <MobileTopBar access={access} />;
}

function bottomNavOf(access: StaffAccess): PanelBottomNavEntry[] {
  const items: PanelBottomNavEntry[] = bottomNavItemsFor(access);
  if (fitsBottomNav(access)) return items;
  const moreRoutes = ["/admin/mais", ...moreItemsFor(access).map((item) => `${item.to}/*`)];
  return [...items, { to: "/admin/mais", label: "Mais", icon: Ellipsis, activeOn: moreRoutes }];
}

/** Navegação no polegar: fixa embaixo no celular, com a aba ativa deslizando entre os itens. */
function BottomNav({ access }: { access: StaffAccess }) {
  const attention = useSupportAttention();
  const whatsapp = useWhatsAppAttention();
  const items = bottomNavOf(access);
  // Sem lugar próprio na barra, o número do Suporte aparece no "Mais".
  const attentionTarget = items.some((entry) => entry.to === SUPPORT_PATH) ? SUPPORT_PATH : "/admin/mais";
  const entries = items.map((entry) => ({
    ...entry,
    extra: (
      <>
        {entry.to === attentionTarget && <AttentionCount count={attention} className="absolute top-1 left-1/2 ml-2" />}
        {entry.to === WHATSAPP_PATH && <AttentionCount count={whatsapp} label={whatsAppAttentionLabel(whatsapp)} className="absolute top-1 left-1/2 ml-2" />}
      </>
    ),
  }));
  return <PanelBottomNav navLabel="Sistema" entries={entries} />;
}

/** Rotas do sistema. Com o Supabase ligado, exigem login de administrador. */
export function AdminProtected() {
  const { state } = useAdminSession();
  const { previewing, viewAccess } = useAdminView();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  usePreviewSubmitGuard(previewing, mainRef);
  const editing = matchesAny([...EDITOR_ROUTES, ...WIDE_EDITOR_ROUTES], location.pathname);
  const formPage = matchesAny(FORM_ROUTES, location.pathname);
  const [focus, setFocus] = useState(false);
  const sidebar = useSidebarCollapsed(focus);

  if (state.status === "loading") return <LoadingBlock label="Abrindo o sistema" />;
  // Sem login, ou com a senha certa mas sem o código do app: a tela de login cuida das duas etapas.
  if (state.status !== "signed-in") return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  // No modo visualização a desenvolvedora navega pelo painel do Jota.
  const access = viewAccess ?? { role: state.session.role, permissions: state.session.permissions };
  // Cada um só abre o que é dele: endereço digitado ou link antigo de outra seção volta para o início de cada um.
  if (!canOpen(access, location.pathname)) return <Navigate to={homePathFor(access)} replace />;

  const panel = (
    <>
      <Sidebar access={access} canPreview={state.session.role === "developer"} collapsed={sidebar.collapsed} onToggle={sidebar.toggle} />
      <div className="transition-[padding] duration-300 ease-out motion-reduce:transition-none md:pl-[var(--sidebar-w,15rem)]">
        <PixReconciler enabled={canOpen(access, "/admin/pedidos")} />
        <PreviewBanner />
        <TopBar access={access} />
        <main
          ref={mainRef}
          id="conteudo"
          className={cn("px-4 pt-5 pb-32 sm:px-6 md:px-8 md:pt-8 md:pb-16", formPage && !focus && "mx-auto md:max-w-[68rem]")}
        >
          <FocusLayoutProvider onChange={setFocus}>
            <Suspense fallback={<LoadingBlock />}>
              <Outlet />
            </Suspense>
          </FocusLayoutProvider>
        </main>
      </div>
      {!editing && <BottomNav access={access} />}
    </>
  );
  // O ajudante não usa o suporte: nada de consultar os chamados para ele. No modo visualização o contador é o do Jota.
  const withWhatsApp = <WhatsAppAttentionProvider enabled={canUseStoreArea(access, "automation")}>{panel}</WhatsAppAttentionProvider>;
  if (access.role === "helper") return withWhatsApp;
  return <SupportAttentionProvider role={supportRoleOf(access.role)}>{withWhatsApp}</SupportAttentionProvider>;
}

export function AdminRoot() {
  useNoIndex();
  useFixedViewport();
  usePanelApp();
  return (
    <AdminSessionProvider>
      <AdminViewProvider>
        <ToastProvider>
          <div className="min-h-screen bg-ink">
            <Suspense fallback={<LoadingBlock />}>
              <Outlet />
            </Suspense>
          </div>
        </ToastProvider>
      </AdminViewProvider>
    </AdminSessionProvider>
  );
}
