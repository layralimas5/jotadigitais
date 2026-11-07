import {
  CircleCheckBig,
  Globe,
  Handshake,
  ImageIcon,
  KeyRound,
  LifeBuoy,
  LayoutDashboard,
  Mail,
  Package,
  PlugZap,
  Receipt,
  Settings,
  ShieldCheck,
  ShieldUser,
  SquareKanban,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import { matchPath } from "react-router-dom";
import type { AdminRole } from "@/domain/admin-user";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Aparece direto na barra de baixo do celular; os outros ficam em "Mais". */
  inBottomNav: boolean;
  description: string;
  /** Quem vê. A desenvolvedora só acompanha o dashboard e cuida do suporte; o resto é da loja do Jota. */
  roles: readonly AdminRole[];
}

export interface NavGroup {
  /** Grupo sem rótulo fica no topo do menu, sozinho. */
  label: string | null;
  items: readonly NavItem[];
}

export const HOME_PATH = "/admin/dashboard";
export const SETTINGS_PATH = "/admin/configuracoes";
export const SUPPORT_PATH = "/admin/suporte";

const EVERYONE: readonly AdminRole[] = ["admin", "developer"];
const STORE: readonly AdminRole[] = ["admin"];
/** TI: só a desenvolvedora. */
const DEVELOPER: readonly AdminRole[] = ["developer"];

export const ACCESS_PATH = "/admin/acessos";
export const NEW_ACCESS_PATH = `${ACCESS_PATH}/novo`;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: null,
    items: [
      { to: HOME_PATH, label: "Dashboard", icon: LayoutDashboard, inBottomNav: true, description: "Visão geral da loja", roles: EVERYONE },
    ],
  },
  {
    label: "Vendas",
    items: [
      { to: "/admin/contas", label: "Contas", icon: Package, inBottomNav: true, description: "Estoque da vitrine", roles: STORE },
      { to: "/admin/emails", label: "E-mails", icon: Mail, inBottomNav: false, description: "Senhas das contas em crescimento", roles: STORE },
      { to: "/admin/pedidos", label: "Pedidos", icon: Receipt, inBottomNav: true, description: "Pagamentos e entregas", roles: STORE },
      { to: "/admin/finalizados", label: "Finalizados", icon: CircleCheckBig, inBottomNav: false, description: "Vendas entregues e garantia", roles: STORE },
      { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, inBottomNav: false, description: "Receitas, despesas e lucro", roles: STORE },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/admin/clientes", label: "Clientes", icon: Users, inBottomNav: false, description: "Quem já comprou", roles: STORE },
      { to: "/admin/parceiros", label: "Parceiros", icon: Handshake, inBottomNav: false, description: "Fornecedores e comissões", roles: STORE },
      { to: "/admin/crm", label: "CRM", icon: SquareKanban, inBottomNav: true, description: "Leads até fechar", roles: STORE },
      { to: "/admin/automacao", label: "Automação", icon: Workflow, inBottomNav: false, description: "Mensagens do WhatsApp", roles: STORE },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/site", label: "Site", icon: Globe, inBottomNav: false, description: "Contato, garantia e vitrine", roles: STORE },
      { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon, inBottomNav: false, description: "Prints da faixa de resultados", roles: STORE },
      { to: "/admin/usuarios", label: "Usuários", icon: ShieldUser, inBottomNav: false, description: "Quem acessa o sistema", roles: STORE },
      { to: "/admin/privacidade", label: "Privacidade", icon: ShieldCheck, inBottomNav: false, description: "LGPD e pedidos dos titulares", roles: STORE },
      { to: "/admin/apis", label: "APIs", icon: PlugZap, inBottomNav: false, description: "Google Agenda e outras conexões", roles: STORE },
      { to: SUPPORT_PATH, label: "Suporte", icon: LifeBuoy, inBottomNav: false, description: "Chamados de ajustes no sistema e no site", roles: EVERYONE },
      { to: ACCESS_PATH, label: "Acessos", icon: KeyRound, inBottomNav: false, description: "TI: e-mail, senha e sessões de cada usuário", roles: DEVELOPER },
      { to: SETTINGS_PATH, label: "Configurações", icon: Settings, inBottomNav: false, description: "Perfil, senha e backup", roles: EVERYONE },
    ],
  },
];

/** Até este número de seções, o celular mostra todas na barra de baixo, sem "Mais". */
export const MAX_BOTTOM_NAV = 5;

export const navGroupsFor = (role: AdminRole): NavGroup[] =>
  NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => item.roles.includes(role)) })).filter(
    (group) => group.items.length > 0,
  );

const itemsFor = (role: AdminRole) => navGroupsFor(role).flatMap((group) => group.items);

/** Cabem todas na barra de baixo (a desenvolvedora): nada vai para "Mais". */
export const fitsBottomNav = (role: AdminRole) => itemsFor(role).length <= MAX_BOTTOM_NAV;

export const bottomNavItemsFor = (role: AdminRole): NavItem[] =>
  fitsBottomNav(role) ? itemsFor(role) : itemsFor(role).filter((item) => item.inBottomNav);

/** Seções que no celular ficam dentro de "Mais". */
export const moreItemsFor = (role: AdminRole): NavItem[] =>
  fitsBottomNav(role) ? [] : itemsFor(role).filter((item) => !item.inBottomNav);

/** Telas fora do menu: cada uma diz quem pode abrir. */
const EXTRA_ROUTES: readonly { pattern: string; roles: readonly AdminRole[] }[] = [
  { pattern: "/admin/mais", roles: STORE },
  { pattern: "/admin/minha-conta", roles: EVERYONE },
];

/** A pessoa pode abrir este endereço do painel? Vale para a seção e tudo o que está dentro dela. */
export function canOpen(role: AdminRole, pathname: string): boolean {
  const section = NAV_GROUPS.flatMap((group) => group.items).find(
    (item) => matchPath(`${item.to}/*`, pathname) !== null,
  );
  if (section) return section.roles.includes(role);
  const extra = EXTRA_ROUTES.find((route) => matchPath(route.pattern, pathname) !== null);
  return extra ? extra.roles.includes(role) : false;
}
