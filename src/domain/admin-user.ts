/** Pessoa com acesso ao sistema. */
export interface AdminUser {
  id: string;
  name: string | null;
  email: string;
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
