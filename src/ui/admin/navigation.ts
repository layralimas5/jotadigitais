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
import { helperCan, type AdminRole, type StaffAccess, type StaffPermission } from "@/domain/admin-user";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Aparece direto na barra de baixo do celular; os outros ficam em "Mais". */
  inBottomNav: boolean;
  description: string;
  /** Quem vê. A desenvolvedora só acompanha o dashboard e cuida do suporte; o resto é da loja do Jota. */
  roles: readonly AdminRole[];
  /** Área que libera a seção para o ajudante. Sem área, o ajudante só vê se o papel dele estiver em `roles`. */
  area?: StaffPermission;
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
/** Telas pessoais (perfil, senha): todo mundo que entra, inclusive o ajudante. */
const ALL_STAFF: readonly AdminRole[] = ["admin", "developer", "helper"];
const STORE: readonly AdminRole[] = ["admin"];
/** TI: só a desenvolvedora. */
const DEVELOPER: readonly AdminRole[] = ["developer"];

export const ACCESS_PATH = "/admin/acessos";
export const NEW_ACCESS_PATH = `${ACCESS_PATH}/novo`;

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: null,
    items: [
      { to: HOME_PATH, label: "Dashboard", icon: LayoutDashboard, inBottomNav: true, description: "Visão geral da loja", roles: EVERYONE, area: "finance" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { to: "/admin/contas", label: "Contas", icon: Package, inBottomNav: true, description: "Estoque da vitrine", roles: STORE, area: "accounts" },
      { to: "/admin/emails", label: "E-mails", icon: Mail, inBottomNav: false, description: "Senhas das contas em crescimento", roles: STORE, area: "emails" },
      { to: "/admin/pedidos", label: "Pedidos", icon: Receipt, inBottomNav: true, description: "Pagamentos e entregas", roles: STORE, area: "orders" },
      { to: "/admin/finalizados", label: "Finalizados", icon: CircleCheckBig, inBottomNav: false, description: "Vendas entregues e garantia", roles: STORE, area: "orders" },
      { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, inBottomNav: false, description: "Receitas, despesas e lucro", roles: STORE, area: "finance" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/admin/clientes", label: "Clientes", icon: Users, inBottomNav: false, description: "Quem já comprou", roles: STORE, area: "customers" },
      { to: "/admin/parceiros", label: "Parceiros", icon: Handshake, inBottomNav: false, description: "Fornecedores e comissões", roles: STORE, area: "partners" },
      { to: "/admin/crm", label: "CRM", icon: SquareKanban, inBottomNav: true, description: "Leads até fechar", roles: STORE, area: "crm" },
      { to: "/admin/automacao", label: "Automação", icon: Workflow, inBottomNav: false, description: "Mensagens do WhatsApp", roles: STORE, area: "automation" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/site", label: "Site", icon: Globe, inBottomNav: false, description: "Contato, garantia e vitrine", roles: STORE, area: "site" },
      { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon, inBottomNav: false, description: "Prints da faixa de resultados", roles: STORE, area: "site" },
      { to: "/admin/usuarios", label: "Usuários", icon: ShieldUser, inBottomNav: false, description: "Quem acessa o sistema", roles: STORE },
      { to: "/admin/privacidade", label: "Privacidade", icon: ShieldCheck, inBottomNav: false, description: "LGPD e pedidos dos titulares", roles: STORE },
      { to: "/admin/apis", label: "APIs", icon: PlugZap, inBottomNav: false, description: "Google Agenda e outras conexões", roles: STORE },
      { to: SUPPORT_PATH, label: "Suporte", icon: LifeBuoy, inBottomNav: false, description: "Chamados de ajustes no sistema e no site", roles: EVERYONE },
      { to: ACCESS_PATH, label: "Acessos", icon: KeyRound, inBottomNav: false, description: "TI: e-mail, senha e sessões de cada usuário", roles: DEVELOPER },
      { to: SETTINGS_PATH, label: "Configurações", icon: Settings, inBottomNav: false, description: "Perfil, senha e backup", roles: ALL_STAFF },
    ],
  },
];

/** Até este número de seções, o celular mostra todas na barra de baixo, sem "Mais". */
export const MAX_BOTTOM_NAV = 5;

/** O papel vê a seção, ou o ajudante tem a área dela liberada. */
const canSee = (item: Pick<NavItem, "roles" | "area">, access: StaffAccess) =>
  item.roles.includes(access.role) || (item.area !== undefined && helperCan(access, item.area));

export const navGroupsFor = (access: StaffAccess): NavGroup[] =>
  NAV_GROUPS.map((group) => ({ ...group, items: group.items.filter((item) => canSee(item, access)) })).filter(
    (group) => group.items.length > 0,
  );

const itemsFor = (access: StaffAccess) => navGroupsFor(access).flatMap((group) => group.items);

/** Cabem todas na barra de baixo (a desenvolvedora, um ajudante com poucas áreas): nada vai para "Mais". */
export const fitsBottomNav = (access: StaffAccess) => itemsFor(access).length <= MAX_BOTTOM_NAV;

export const bottomNavItemsFor = (access: StaffAccess): NavItem[] =>
  fitsBottomNav(access) ? itemsFor(access) : itemsFor(access).filter((item) => item.inBottomNav);

/** Seções que no celular ficam dentro de "Mais". */
export const moreItemsFor = (access: StaffAccess): NavItem[] =>
  fitsBottomNav(access) ? [] : itemsFor(access).filter((item) => !item.inBottomNav);

/** Primeira tela de quem entra: o dashboard, ou a primeira área liberada do ajudante (Configurações sempre abre). */
export const homePathFor = (access: StaffAccess): string => itemsFor(access)[0]?.to ?? SETTINGS_PATH;

/** Telas fora do menu: cada uma diz quem pode abrir. */
const EXTRA_ROUTES: readonly { pattern: string; roles: readonly AdminRole[] }[] = [
  { pattern: "/admin/mais", roles: ALL_STAFF },
  { pattern: "/admin/minha-conta", roles: ALL_STAFF },
];

/** A pessoa pode abrir este endereço do painel? Vale para a seção e tudo o que está dentro dela. */
export function canOpen(access: StaffAccess, pathname: string): boolean {
  const section = NAV_GROUPS.flatMap((group) => group.items).find(
    (item) => matchPath(`${item.to}/*`, pathname) !== null,
  );
  if (section) return canSee(section, access);
  const extra = EXTRA_ROUTES.find((route) => matchPath(route.pattern, pathname) !== null);
  return extra ? extra.roles.includes(access.role) : false;
}
