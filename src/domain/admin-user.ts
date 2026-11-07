/**
 * Admin (o Jota) tem a loja inteira; a desenvolvedora cuida do sistema; o ajudante só vê as áreas que o admin liberou.
 * O banco confere tudo de novo (has_permission): esconder no painel é só para não mostrar o que não abre.
 */
export type AdminRole = "admin" | "developer" | "helper";

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  admin: "Admin",
  developer: "Desenvolvedora",
  helper: "Ajudante",
};

/** Áreas que o admin libera para um ajudante. Mesma lista da constraint de admin_users.permissions. */
export const STAFF_PERMISSIONS = ["accounts", "emails", "orders", "customers", "partners", "crm", "automation", "finance", "site"] as const;
export type StaffPermission = (typeof STAFF_PERMISSIONS)[number];

export const STAFF_PERMISSION_LABEL: Record<StaffPermission, string> = {
  accounts: "Contas",
  emails: "E-mails",
  orders: "Pedidos e entregas",
  customers: "Clientes",
  partners: "Parceiros",
  crm: "CRM",
  automation: "Automação",
  finance: "Dashboard e financeiro",
  site: "Site e depoimentos",
};

export const STAFF_PERMISSION_HINT: Record<StaffPermission, string> = {
  accounts: "Cadastrar, editar e tirar contas da vitrine, com fotos e dados.",
  emails: "Ver e editar os e-mails e as senhas das contas em crescimento.",
  orders: "Ver os pedidos, confirmar o Pix, entregar e mandar a mensagem para quem comprou.",
  customers: "Ver e editar a ficha de quem já comprou (sem o CPF).",
  partners: "Ver os parceiros, as contas de cada um e as comissões.",
  crm: "Ver e mover os leads até fechar.",
  automation: "Editar as mensagens prontas do WhatsApp.",
  finance: "Ver o dashboard com o faturamento e lançar receitas e despesas.",
  site: "Editar os textos, o contato e os depoimentos do site.",
};

/** Quem está usando o painel: o papel e, no ajudante, as áreas liberadas. */
export interface StaffAccess {
  role: AdminRole;
  permissions: readonly StaffPermission[];
}

/** O ajudante abre a área? Admin e desenvolvedora seguem as regras de cada seção do menu. */
export const helperCan = (access: StaffAccess, permission: StaffPermission): boolean =>
  access.role === "helper" && access.permissions.includes(permission);

/** O admin vê a área inteira; o ajudante, só o que foi liberado. Para ações dentro de uma tela da loja. */
export const canUseStoreArea = (access: StaffAccess, permission: StaffPermission): boolean =>
  access.role === "admin" || helperCan(access, permission);

/** Pessoa com acesso ao sistema. */
export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
  /** Só no ajudante; nos outros papéis, vazio. */
  permissions: StaffPermission[];
  createdAt: string;
  lastSignInAt: string | null;
}

/** Papéis que o admin escolhe no cadastro. A desenvolvedora não se cria por aqui. */
export type AssignableRole = Extract<AdminRole, "admin" | "helper">;

export interface AdminUserAccess {
  role: AssignableRole;
  permissions: StaffPermission[];
}

export interface NewAdminUser extends AdminUserAccess {
  name: string;
  email: string;
  /** Senha provisória: a pessoa troca em Configurações depois do primeiro acesso. */
  password: string;
}

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Em ordem fixa e sem repetir, como o banco guarda. */
export const normalizePermissions = (permissions: readonly StaffPermission[]): StaffPermission[] =>
  STAFF_PERMISSIONS.filter((permission) => permissions.includes(permission));
