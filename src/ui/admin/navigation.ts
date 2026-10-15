import {
  ImageIcon,
  Package,
  PlugZap,
  Receipt,
  Settings,
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
  label: string;
  items: readonly NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: "Loja",
    items: [
      { to: "/admin/contas", label: "Contas", icon: Package, inBottomNav: true, description: "Estoque da vitrine" },
      { to: "/admin/depoimentos", label: "Depoimentos", icon: ImageIcon, inBottomNav: false, description: "Prints da faixa de resultados" },
      { to: "/admin/pedidos", label: "Pedidos", icon: Receipt, inBottomNav: true, description: "Pagamentos e entregas" },
      { to: "/admin/financeiro", label: "Financeiro", icon: Wallet, inBottomNav: false, description: "Faturamento, despesas e lucro" },
    ],
  },
  {
    label: "Relacionamento",
    items: [
      { to: "/admin/clientes", label: "Clientes", icon: Users, inBottomNav: true, description: "Quem já comprou" },
      { to: "/admin/crm", label: "CRM", icon: SquareKanban, inBottomNav: true, description: "Leads até fechar" },
      { to: "/admin/automacao", label: "Automação", icon: Workflow, inBottomNav: false, description: "Mensagens do WhatsApp" },
    ],
  },
  {
    label: "Sistema",
    items: [
      { to: "/admin/apis", label: "APIs", icon: PlugZap, inBottomNav: false, description: "IA e conexão de contas" },
      { to: "/admin/configuracoes", label: "Configurações", icon: Settings, inBottomNav: false, description: "Contato e garantia da loja" },
    ],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

export const BOTTOM_NAV_ITEMS = ALL_ITEMS.filter((item) => item.inBottomNav);

/** Seções que no celular ficam dentro de "Mais". */
export const MORE_ITEMS = ALL_ITEMS.filter((item) => !item.inBottomNav);
