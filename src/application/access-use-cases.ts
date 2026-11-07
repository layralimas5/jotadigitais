import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import type { AdminRole } from "@/domain/admin-user";
import { AccessForbiddenError } from "@/domain/errors";
import type { AdminDeps } from "./admin-use-cases";
import { accessPasswordSchema, accessProfileSchema, parseOrThrow } from "./schemas";

/** A aba Acessos é da TI: o servidor também confere, aqui só se evita a ida à toa. */
function requireDeveloper(role: AdminRole): void {
  if (role !== "developer") throw new AccessForbiddenError();
}

export function listAccessUsers(deps: AdminDeps, role: AdminRole): Promise<AccessUser[]> {
  requireDeveloper(role);
  return deps.access.listAll();
}

export async function updateAccessProfile(deps: AdminDeps, role: AdminRole, userId: string, raw: unknown): Promise<AccessProfileUpdate> {
  requireDeveloper(role);
  const update = parseOrThrow(accessProfileSchema, raw);
  await deps.access.updateProfile(userId, update);
  return update;
}

/** Devolve a senha que valeu, para montar a mensagem de acesso. */
export async function setAccessPassword(deps: AdminDeps, role: AdminRole, userId: string, raw: unknown): Promise<string> {
  requireDeveloper(role);
  const { password } = parseOrThrow(accessPasswordSchema, raw);
  await deps.access.setPassword(userId, password);
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
