import type { StaffAccess } from "@/domain/admin-user";
import { pushKindsFor, type PushDeviceStatus, type PushKind } from "@/domain/push";
import type { AdminDeps } from "./admin-use-cases";

export interface PushSettings {
  status: PushDeviceStatus;
  /** Tipos ligados. Quem nunca escolheu recebe todos os que pode ver. */
  kinds: PushKind[];
}

export async function loadPushSettings(deps: AdminDeps, access: StaffAccess): Promise<PushSettings> {
  const allowed = pushKindsFor(access).map((option) => option.kind);
  const [status, saved] = await Promise.all([deps.push.status(), deps.push.loadPreferences()]);
  return { status, kinds: saved ? saved.filter((kind) => allowed.includes(kind)) : allowed };
}

/** Grava só os tipos que o papel pode receber; o resto é descartado. */
export function savePushKinds(deps: AdminDeps, access: StaffAccess, kinds: readonly PushKind[]): Promise<void> {
  const allowed = new Set(pushKindsFor(access).map((option) => option.kind));
  return deps.push.savePreferences(kinds.filter((kind) => allowed.has(kind)));
}

export const enablePush = (deps: AdminDeps) => deps.push.enable();
export const disablePush = (deps: AdminDeps) => deps.push.disable();
export const sendTestPush = (deps: AdminDeps) => deps.push.sendTest();
