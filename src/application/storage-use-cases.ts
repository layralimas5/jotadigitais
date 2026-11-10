import type { AdminRole } from "@/domain/admin-user";
import { StorageForbiddenError } from "@/domain/errors";
import type { DatabaseUsage } from "@/domain/storage";
import type { AdminDeps } from "./admin-use-cases";

/** Resultado de um banco: o uso lido ou o motivo da falha, sem derrubar a leitura dos outros. */
export type StorageReading = { status: "ok"; usage: DatabaseUsage } | { status: "error"; name: string; message: string };

/** Aba Armazenamento é do admin e da desenvolvedora; o banco confere de novo. */
export const canSeeStorage = (role: AdminRole): boolean => role === "admin" || role === "developer";

export async function loadStorageUsage(deps: AdminDeps, role: AdminRole): Promise<StorageReading[]> {
  if (!canSeeStorage(role)) throw new StorageForbiddenError();
  const results = await Promise.allSettled(deps.storage.map((reader) => reader.read()));
  return results.map((result, index): StorageReading =>
    result.status === "fulfilled"
      ? { status: "ok", usage: result.value }
      : {
          status: "error",
          name: deps.storage[index]?.name ?? "Banco",
          message: result.reason instanceof Error ? result.reason.message : "Não foi possível ler o uso.",
        },
  );
}
