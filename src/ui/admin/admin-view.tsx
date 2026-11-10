import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container, SANDBOX_STORAGE_KEY, sandboxAdminDeps } from "@/app/container";
import { previewAdminDeps } from "@/application/admin-preview";
import type { AdminDeps } from "@/application/admin-use-cases";
import { STAFF_PERMISSIONS, type AdminRole, type StaffAccess, type StaffPermission } from "@/domain/admin-user";
import { useAdminSession } from "./session";

/**
 * Como a desenvolvedora está usando o painel:
 * - "self": o painel dela;
 * - "preview": vendo como o Jota ou um ajudante, com os dados reais mascarados e nada salvo;
 * - "sandbox": testando como essa pessoa, com dados de exemplo só deste navegador, onde tudo funciona.
 */
export type ViewMode = "self" | "preview" | "sandbox";

/** Vale só para esta aba do navegador: fechar e abrir de novo volta para o painel da desenvolvedora. */
const STORAGE_KEY = "jd:view-as-admin";
const SUBJECT_KEY = "jd:view-as-subject";

/** De quem é o painel que a desenvolvedora está vendo ou testando: o nome e o acesso dessa pessoa. */
export interface ViewSubject {
  name: string;
  access: StaffAccess;
}

export const JOTA_SUBJECT: ViewSubject = { name: "o Jota", access: { role: "admin", permissions: [] } };

const isPermission = (value: unknown): value is StaffPermission => STAFF_PERMISSIONS.some((permission) => permission === value);

function readSubject(): ViewSubject {
  try {
    const raw = window.sessionStorage.getItem(SUBJECT_KEY);
    if (!raw) return JOTA_SUBJECT;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return JOTA_SUBJECT;
    const { name, role, permissions } = parsed as Record<string, unknown>;
    if (typeof name !== "string" || (role !== "admin" && role !== "helper")) return JOTA_SUBJECT;
    const allowed = role === "helper" && Array.isArray(permissions) ? permissions.filter(isPermission) : [];
    return { name, access: { role, permissions: allowed } };
  } catch {
    return JOTA_SUBJECT;
  }
}

function storeSubject(subject: ViewSubject): void {
  try {
    if (subject === JOTA_SUBJECT) window.sessionStorage.removeItem(SUBJECT_KEY);
    else window.sessionStorage.setItem(SUBJECT_KEY, JSON.stringify({ name: subject.name, ...subject.access }));
  } catch (error) {
    console.warn("Não foi possível lembrar de quem é o painel nesta aba", error);
  }
}

function readStored(): ViewMode {
  try {
    const value = window.sessionStorage.getItem(STORAGE_KEY);
    // "1" é como o modo visualização ficava guardado antes de existir o ambiente de teste.
    if (value === "1" || value === "preview") return "preview";
    return value === "sandbox" ? "sandbox" : "self";
  } catch {
    return "self";
  }
}

function store(mode: ViewMode): void {
  try {
    if (mode === "self") window.sessionStorage.removeItem(STORAGE_KEY);
    else window.sessionStorage.setItem(STORAGE_KEY, mode);
  } catch (error) {
    console.warn("Não foi possível lembrar o modo de visualização nesta aba", error);
  }
}

interface AdminViewValue {
  mode: ViewMode;
  /** Vendo como o Jota com dados reais: dados mascarados e nada é salvo. */
  previewing: boolean;
  /** Testando como o Jota com dados de exemplo: tudo funciona, nada encosta no banco. */
  testing: boolean;
  /** Papel que decide o que aparece no menu e nas telas. Vendo ou testando como alguém, o papel dessa pessoa. */
  viewRole: AdminRole | null;
  /** Papel e áreas liberadas que montam o menu. Vendo ou testando como alguém, o acesso dessa pessoa. */
  viewAccess: StaffAccess | null;
  /** De quem é o painel no modo ver ou testar (o Jota, se ela não escolheu outra pessoa). */
  subject: ViewSubject;
  deps: AdminDeps;
  /** Sem pessoa, continua com quem já estava sendo vista. */
  enterPreview: (subject?: ViewSubject) => void;
  enterSandbox: (subject?: ViewSubject) => void;
  exitPreview: () => void;
}

const AdminViewContext = createContext<AdminViewValue | null>(null);

const previewDeps = previewAdminDeps(container.admin);

const DEPS_OF: Record<ViewMode, () => AdminDeps> = {
  self: () => container.admin,
  preview: () => previewDeps,
  sandbox: sandboxAdminDeps,
};

/** Apaga os dados de exemplo: o próximo teste começa do estoque inicial. */
export function resetSandbox(): void {
  try {
    window.localStorage.removeItem(SANDBOX_STORAGE_KEY);
  } catch (error) {
    console.error("Não foi possível apagar os dados de teste", error);
  }
}

export function AdminViewProvider({ children }: { children: ReactNode }) {
  const { state } = useAdminSession();
  const [stored, setStored] = useState<ViewMode>(readStored);
  const [subject, setSubject] = useState<ViewSubject>(readSubject);
  const role = state.status === "signed-in" ? state.session.role : null;
  const permissions = state.status === "signed-in" ? state.session.permissions : null;
  // Só a desenvolvedora vê ou testa como o Jota.
  const mode: ViewMode = role === "developer" ? stored : "self";

  // Sair do sistema encerra o modo: o próximo login começa no painel de cada um.
  useEffect(() => {
    if (state.status === "signed-out") {
      store("self");
      setStored("self");
      storeSubject(JOTA_SUBJECT);
      setSubject(JOTA_SUBJECT);
    }
  }, [state.status]);

  const setMode = useCallback((next: ViewMode, nextSubject?: ViewSubject) => {
    store(next);
    setStored(next);
    if (next === "self" || nextSubject) {
      const chosen = nextSubject ?? JOTA_SUBJECT;
      storeSubject(chosen);
      setSubject(chosen);
    }
  }, []);

  const value = useMemo<AdminViewValue>(
    () => ({
      mode,
      previewing: mode === "preview",
      testing: mode === "sandbox",
      viewRole: mode === "self" ? role : subject.access.role,
      viewAccess: mode === "self" ? (role ? { role, permissions: permissions ?? [] } : null) : subject.access,
      subject,
      deps: DEPS_OF[mode](),
      enterPreview: (next) => setMode("preview", next),
      enterSandbox: (next) => setMode("sandbox", next),
      exitPreview: () => setMode("self"),
    }),
    [mode, role, permissions, subject, setMode],
  );
  return <AdminViewContext.Provider value={value}>{children}</AdminViewContext.Provider>;
}

export function useAdminView(): AdminViewValue {
  const value = useContext(AdminViewContext);
  if (!value) throw new Error("useAdminView precisa estar dentro de AdminViewProvider.");
  return value;
}

/** Repositórios que a tela deve usar: os reais, os do modo visualização ou os do ambiente de teste. */
export const useAdminDeps = (): AdminDeps => useAdminView().deps;

/** Papel que decide menu e telas (vendo ou testando como o Jota, o dele). */
export const useViewRole = (): AdminRole | null => useAdminView().viewRole;

/** Papel e áreas liberadas de quem está vendo (vendo ou testando como o Jota, o dele). */
export const useViewAccess = (): StaffAccess | null => useAdminView().viewAccess;
