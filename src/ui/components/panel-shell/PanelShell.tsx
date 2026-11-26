import { motion, useReducedMotion } from "framer-motion";
import { ChevronRight, ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, matchPath, useLocation } from "react-router-dom";
import { cn } from "@/ui/lib/cn";

/**
 * Casca dos painéis (o da loja e o do afiliado): menu lateral que encolhe, barra de baixo no celular e o "onde você
 * está" do topo. Só aparência e navegação; o que cada painel mostra fica com ele.
 */

export interface PanelNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Só fica ativo no endereço exato (o "Início"). */
  end?: boolean;
  /** Contador ao lado do nome, com o menu aberto. */
  trailing?: ReactNode;
  /** Ponto de aviso sobre o ícone, com o menu encolhido. */
  dot?: boolean;
  /** Nome lido pelo leitor de tela com o menu encolhido (ex.: "Suporte, 2 pendentes"). */
  collapsedLabel?: string;
}

export interface PanelNavGroup {
  /** Nulo = sem título (o grupo do início). */
  label: string | null;
  items: readonly PanelNavItem[];
}

/** Seta na borda do menu lateral: encolhe para só os ícones ou abre de novo. */
export function SidebarToggle({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const Icon = collapsed ? ChevronsRight : ChevronsLeft;
  const label = collapsed ? "Abrir o menu" : "Encolher o menu";
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      aria-expanded={!collapsed}
      title={label}
      className="absolute top-[4.75rem] -right-3.5 z-10 grid size-7 place-items-center rounded-full border border-line-strong bg-surface text-mist shadow-lg shadow-black/40 transition-colors hover:border-electric/50 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
    >
      <Icon aria-hidden className="size-4" />
    </button>
  );
}

interface PanelSidebarProps {
  /** Nome da navegação para o leitor de tela ("Sistema", "Painel do afiliado"). */
  navLabel: string;
  /** Marca no topo do menu aberto e encolhido. */
  brand: ReactNode;
  collapsedBrand: ReactNode;
  groups: readonly PanelNavGroup[];
  /** Atalhos do rodapé do menu (recebe se está encolhido). */
  footer?: (collapsed: boolean) => ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  /** Nome da animação da aba ativa: um por painel. */
  layoutId?: string;
}

/** Menu lateral fixo à esquerda, do tablet para cima. Encolhido, mostra só os ícones (o nome vem no "title"). */
export function PanelSidebar({ navLabel, brand, collapsedBrand, groups, footer, collapsed, onToggle, layoutId = "sidebar-active" }: PanelSidebarProps) {
  const reduceMotion = useReducedMotion();
  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[var(--sidebar-w,15rem)] flex-col border-r border-line bg-night transition-[width] duration-300 ease-out motion-reduce:transition-none md:flex">
      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
      <div className={cn("flex h-[6.25rem] shrink-0 items-center justify-center border-b border-line", collapsed ? "px-2" : "px-5")}>
        {collapsed ? collapsedBrand : brand}
      </div>
      <nav aria-label={navLabel} className={cn("flex-1 overflow-x-hidden overflow-y-auto p-3", collapsed ? "space-y-3" : "space-y-5")}>
        {groups.map((group, index) => (
          <div key={group.label ?? "inicio"}>
            {group.label &&
              (collapsed ? (
                index > 0 && <span aria-hidden className="mx-auto mb-3 block h-px w-6 bg-line" />
              ) : (
                <p className="px-3 pb-1.5 text-[0.65rem] font-semibold tracking-[0.16em] whitespace-nowrap text-mist/70 uppercase">{group.label}</p>
              ))}
            <ul className="space-y-0.5">
              {group.items.map(({ to, label, icon: Icon, end, trailing, dot, collapsedLabel }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    title={collapsed ? label : undefined}
                    aria-label={collapsed ? collapsedLabel : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-medium",
                      collapsed ? "justify-center px-0" : "px-3",
                    )}
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <motion.span
                            layoutId={layoutId}
                            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 40 }}
                            className="absolute inset-0 rounded-xl border border-electric/30 bg-electric/10"
                          />
                        )}
                        <Icon aria-hidden className={cn("relative size-[1.1rem] shrink-0", isActive ? "text-electric" : "text-mist")} />
                        {collapsed ? (
                          dot && <span aria-hidden className="absolute top-1.5 right-3 size-2 rounded-full bg-pink ring-2 ring-night" />
                        ) : (
                          <>
                            <span className={cn("relative whitespace-nowrap", isActive ? "text-white" : "text-mist hover:text-white")}>{label}</span>
                            {trailing}
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
      {footer && <div className="space-y-1 border-t border-line p-3">{footer(collapsed)}</div>}
    </aside>
  );
}

export interface PanelBottomNavEntry {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** "Mais" fica ativo também nas seções que moram dentro dele. */
  activeOn?: readonly string[];
  /** Contador sobre o ícone. */
  extra?: ReactNode;
}

const matchesAny = (patterns: readonly string[], pathname: string) => patterns.some((pattern) => matchPath(pattern, pathname) !== null);

/** Navegação no polegar: fixa embaixo no celular, com a aba ativa deslizando entre os itens. */
export function PanelBottomNav({ navLabel, entries, layoutId = "bottom-nav-active" }: { navLabel: string; entries: readonly PanelBottomNavEntry[]; layoutId?: string }) {
  const reduceMotion = useReducedMotion();
  const { pathname } = useLocation();
  return (
    <nav aria-label={navLabel} className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-black/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <div className="grid px-1 py-1.5" style={{ gridTemplateColumns: `repeat(${entries.length}, minmax(0, 1fr))` }}>
        {entries.map(({ to, label, icon: Icon, end, activeOn, extra }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className="relative flex flex-col items-center gap-0.5 rounded-2xl py-2 text-[0.7rem] font-medium"
          >
            {({ isActive: linkActive }) => {
              const isActive = activeOn ? matchesAny(activeOn, pathname) : linkActive;
              return (
                <>
                  {isActive && (
                    <motion.span
                      layoutId={layoutId}
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 500, damping: 38 }}
                      className="absolute inset-0 rounded-2xl bg-white/[0.08]"
                    />
                  )}
                  <Icon aria-hidden className={cn("relative size-5", isActive ? "text-electric" : "text-mist")} />
                  <span className={cn("relative", isActive ? "text-white" : "text-mist")}>{label}</span>
                  {extra}
                </>
              );
            }}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}

/** "Ganhos › Extrato": onde a pessoa está, no lado esquerdo do topo. */
export function PanelCrumb({ section, page }: { section: string; page: string }) {
  return (
    <nav aria-label="Você está em" className="min-w-0">
      <ol className="flex min-w-0 items-center gap-1.5 text-sm">
        <li className="hidden shrink-0 text-mist xl:block">{section}</li>
        <li aria-hidden className="hidden shrink-0 text-line-strong xl:block">
          <ChevronRight className="size-3.5" />
        </li>
        <li aria-current="page" className="truncate font-medium text-white">
          {page}
        </li>
      </ol>
    </nav>
  );
}
