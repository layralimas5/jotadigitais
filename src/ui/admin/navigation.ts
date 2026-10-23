import {
  CircleCheckBig,
  Globe,
  Handshake,
  ImageIcon,
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

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Aparece direto na barra de baixo do celular; os outros ficam em "Mais". */
  inBottomNav: boolean;
  description: string;
}

export interface NavGroup {
  /** Grupo sem rótulo fica no topo do menu, sozinho. */
  label: string | null;
  items: readonly NavItem[];
}

export const HOME_PATH = "/admin/dashboard";
export const SETTINGS_PATH = "/admin/configuracoes";

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: null,
    items: [
      { to: HOME_PATH, label: "Dashboard", icon: LayoutDashboard, inBottomNav: true, description: "Visão geral da loja" },
    ],
  },
  {
    label: "Vendas",
    items: [
      { to: "/admin/contas", label: "Contas", icon: Package, inBottomNav: true, description: "Estoque da vitrine" },
      { to: "/admin/emails", label: "E-mails", icon: Mail, inBottomNav: false, description: "Senhas das contas em crescimento" },
      { to: "/admin/pedidos", label: "Pedidos", icon: Receipt, inBottomNav: true, description: "Pagamentos e entregas" },
      { to: "/admin/finalizados", label: "Finalizados", icon: CircleCheckBig, inBottomNav: false, description: "Vendas entregues e garantia" },
      { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, inBottomNav: false, description: "Receitas, despesas e lucro" },
    ],
  },
  {
    label: "Pessoas",
    items: [
      { to: "/admin/clientes", label: "Clientes", icon: Users, inBottomNav: false, description: "Quem já comprou" },
      { to: "/admin/parceiros", label: "Parceiros", icon: Handshake, inBottomNav: false, description: "Fornecedores e comissões" },
      { to: "/admin/crm", label: "CRM", icon: SquareKanban, inBottomNav: true, description: "Leads até fechar" },
      { to: "/admin/automacao", label: "Automação", icon: Workflow, inBottomNav: false, description: "Mensagens do WhatsApp" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/site", label: "Site", icon: Globe, inBottomNav: false, description: "Contato, garantia e vitrine" },
      { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon, inBottomNav: false, description: "Prints da faixa de resultados" },
      { to: "/admin/usuarios", label: "Usuários", icon: ShieldUser, inBottomNav: false, description: "Quem acessa o sistema" },
      { to: "/admin/privacidade", label: "Privacidade", icon: ShieldCheck, inBottomNav: false, description: "LGPD e pedidos dos titulares" },
      { to: "/admin/apis", label: "APIs", icon: PlugZap, inBottomNav: false, description: "Google Agenda e outras conexões" },
      { to: SETTINGS_PATH, label: "Configurações", icon: Settings, inBottomNav: false, description: "Perfil, senha e backup" },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const BOTTOM_NAV_ITEMS = ALL_ITEMS.filter((item) => item.inBottomNav);

/** Seções que no celular ficam dentro de "Mais". */
export const MORE_ITEMS = ALL_ITEMS.filter((item) => !item.inBottomNav);
