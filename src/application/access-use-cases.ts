import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import { canManageLoginOf, type AdminRole, type AdminUser } from "@/domain/admin-user";
import { AccessForbiddenError } from "@/domain/errors";
import type { AdminDeps } from "./admin-use-cases";
import { accessPasswordSchema, accessProfileSchema, parseOrThrow } from "./schemas";

/** A aba Acessos é da TI: o servidor também confere, aqui só se evita a ida à toa. */
function requireDeveloper(role: AdminRole): void {
  if (role !== "developer") throw new AccessForbiddenError();
}

/** Nome, e-mail e senha: a TI muda de todos; o admin, de todos menos da desenvolvedora. */
function requireCanManage(role: AdminRole, target: Pick<AdminUser, "role">): void {
  if (!canManageLoginOf(role, target)) throw new AccessForbiddenError();
}

type ManagedUser = Pick<AdminUser, "id" | "role">;

export function listAccessUsers(deps: AdminDeps, role: AdminRole): Promise<AccessUser[]> {
  requireDeveloper(role);
  return deps.access.listAll();
}

export async function updateAccessProfile(deps: AdminDeps, role: AdminRole, target: ManagedUser, raw: unknown): Promise<AccessProfileUpdate> {
  requireCanManage(role, target);
  const update = parseOrThrow(accessProfileSchema, raw);
  await deps.access.updateProfile(target.id, update);
  return update;
}

/** Devolve a senha que valeu, para montar a mensagem de acesso. */
export async function setAccessPassword(deps: AdminDeps, role: AdminRole, target: ManagedUser, raw: unknown): Promise<string> {
  requireCanManage(role, target);
  const { password } = parseOrThrow(accessPasswordSchema, raw);
  await deps.access.setPassword(target.id, password);
  return password;
}

export function endAccessSessions(deps: AdminDeps, role: AdminRole, userId: string): Promise<void> {
  requireDeveloper(role);
  return deps.access.endSessions(userId);
}

export function resetAccessMfa(deps: AdminDeps, role: AdminRole, userId: string): Promise<void> {
  requireDeveloper(role);
  return deps.access.resetMfa(userId);
}
