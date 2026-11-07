import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container, SANDBOX_STORAGE_KEY, sandboxAdminDeps } from "@/app/container";
import { previewAdminDeps } from "@/application/admin-preview";
import type { AdminDeps } from "@/application/admin-use-cases";
import type { AdminRole, StaffAccess } from "@/domain/admin-user";
import { useAdminSession } from "./session";

/**
 * Como a desenvolvedora está usando o painel:
 * - "self": o painel dela;
 * - "preview": vendo como o Jota, com os dados reais mascarados e nada salvo;
 * - "sandbox": testando como o Jota, com dados de exemplo só deste navegador, onde tudo funciona.
 */
export type ViewMode = "self" | "preview" | "sandbox";

/** Vale só para esta aba do navegador: fechar e abrir de novo volta para o painel da desenvolvedora. */
const STORAGE_KEY = "jd:view-as-admin";

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
  /** Papel que decide o que aparece no menu e nas telas. Vendo ou testando como o Jota, "admin". */
  viewRole: AdminRole | null;
  /** Papel e áreas liberadas que montam o menu. Vendo ou testando como o Jota, o acesso dele. */
  viewAccess: StaffAccess | null;
  deps: AdminDeps;
  enterPreview: () => void;
  enterSandbox: () => void;
  exitPreview: () => void;
}

const AdminViewContext = createContext<AdminViewValue | null>(null);

const previewDeps = previewAdminDeps(container.admin);

const JOTA_ACCESS: StaffAccess = { role: "admin", permissions: [] };

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
  const role = state.status === "signed-in" ? state.session.role : null;
  const permissions = state.status === "signed-in" ? state.session.permissions : null;
  // Só a desenvolvedora vê ou testa como o Jota.
  const mode: ViewMode = role === "developer" ? stored : "self";

  // Sair do sistema encerra o modo: o próximo login começa no painel de cada um.
  useEffect(() => {
    if (state.status === "signed-out") {
      store("self");
      setStored("self");
    }
  }, [state.status]);

  const setMode = useCallback((next: ViewMode) => {
    store(next);
    setStored(next);
  }, []);

  const value = useMemo<AdminViewValue>(
    () => ({
      mode,
      previewing: mode === "preview",
      testing: mode === "sandbox",
      viewRole: mode === "self" ? role : "admin",
      viewAccess: mode === "self" ? (role ? { role, permissions: permissions ?? [] } : null) : JOTA_ACCESS,
      deps: DEPS_OF[mode](),
      enterPreview: () => setMode("preview"),
      enterSandbox: () => setMode("sandbox"),
      exitPreview: () => setMode("self"),
    }),
    [mode, role, permissions, setMode],
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
