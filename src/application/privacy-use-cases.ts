import { DataSubjectNotFoundError } from "@/domain/errors";
import type {
  AnonymizationResult,
  DataRequest,
  OpenedDataRequest,
  RetentionResult,
  SubjectData,
} from "@/domain/privacy";
import type { AdminDeps } from "./admin-use-cases";
import { contactField, dataRequestAnswerSchema, dataRequestSchema, parseOrThrow, privacyAccessSchema, type PrivacyAccess } from "./schemas";
import type { UseCaseDeps } from "./use-cases";

// ---------------------------------------------------------------------------
// Meus dados (site)
// ---------------------------------------------------------------------------

/** Confere contato e código do pedido e devolve tudo o que a loja guarda sobre o titular. */
export async function lookupMyData(deps: Pick<UseCaseDeps, "privacy">, raw: unknown): Promise<{ access: PrivacyAccess; data: SubjectData }> {
  const access = parseOrThrow(privacyAccessSchema, raw);
  const data = await deps.privacy.lookup(access.contact, access.orderCode);
  if (!data) throw new DataSubjectNotFoundError();
  return { access, data };
}

export async function openDataRequest(
  deps: Pick<UseCaseDeps, "privacy">,
  access: PrivacyAccess,
  raw: unknown,
): Promise<OpenedDataRequest> {
  const request = parseOrThrow(dataRequestSchema, raw);
  const opened = await deps.privacy.request(access.contact, access.orderCode, request.kind, request.details);
  if (!opened) throw new DataSubjectNotFoundError();
  return opened;
}

// ---------------------------------------------------------------------------
// Painel
// ---------------------------------------------------------------------------

/** Abertas primeiro (prazo mais curto no topo), depois as respondidas, da mais recente para a mais antiga. */
export async function listDataRequests(deps: AdminDeps): Promise<DataRequest[]> {
  const requests = await deps.privacy.listRequests();
  return [...requests].sort((a, b) => {
    if ((a.status === "open") !== (b.status === "open")) return a.status === "open" ? -1 : 1;
    return a.status === "open" ? a.dueAt.localeCompare(b.dueAt) : b.createdAt.localeCompare(a.createdAt);
  });
}

export function answerDataRequest(deps: AdminDeps, id: string, raw: unknown): Promise<void> {
  return deps.privacy.answer(id, parseOrThrow(dataRequestAnswerSchema, raw));
}

export function anonymizeDataSubject(deps: AdminDeps, contact: string): Promise<AnonymizationResult> {
  return deps.privacy.anonymizeSubject(parseOrThrow(contactField, contact));
}

export function applyRetentionPolicy(deps: AdminDeps): Promise<RetentionResult> {
  return deps.privacy.applyRetention();
}
