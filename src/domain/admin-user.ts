/** Mesmo acesso para os dois; o papel só identifica quem é quem. */
export type AdminRole = "admin" | "developer";

export const ADMIN_ROLE_LABEL: Record<AdminRole, string> = {
  admin: "Admin",
  developer: "Desenvolvedora",
};

/** Pessoa com acesso ao sistema. */
export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
  role: AdminRole;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface NewAdminUser {
  name: string;
  email: string;
  /** Senha provisória: a pessoa troca em Configurações depois do primeiro acesso. */
  password: string;
}

export const sameEmail = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
