import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import { previewAdminDeps } from "@/application/admin-preview";
import type { AdminDeps } from "@/application/admin-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import { useAdminSession } from "./session";

/** Vale só para esta aba do navegador: fechar e abrir de novo volta para o painel da desenvolvedora. */
const STORAGE_KEY = "jd:view-as-admin";

function readStored(): boolean {
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function store(on: boolean): void {
  try {
    if (on) window.sessionStorage.setItem(STORAGE_KEY, "1");
    else window.sessionStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Não foi possível lembrar o modo visualização nesta aba", error);
  }
}

interface AdminViewValue {
  /** A desenvolvedora está vendo o painel como o Jota (dados mascarados, nada é salvo). */
  previewing: boolean;
  /** Papel que decide o que aparece no menu e nas telas. No modo visualização, "admin". */
  viewRole: AdminRole | null;
  deps: AdminDeps;
  enterPreview: () => void;
  exitPreview: () => void;
}

const AdminViewContext = createContext<AdminViewValue | null>(null);

const previewDeps = previewAdminDeps(container.admin);

export function AdminViewProvider({ children }: { children: ReactNode }) {
  const { state } = useAdminSession();
  const [stored, setStored] = useState(readStored);
  const role = state.status === "signed-in" ? state.session.role : null;
  const previewing = role === "developer" && stored;

  // Sair do sistema encerra o modo: o próximo login começa no painel de cada um.
  useEffect(() => {
    if (state.status === "signed-out") {
      store(false);
      setStored(false);
    }
  }, [state.status]);

  const setPreview = useCallback((on: boolean) => {
    store(on);
    setStored(on);
  }, []);

  const value = useMemo<AdminViewValue>(
    () => ({
      previewing,
      viewRole: previewing ? "admin" : role,
      deps: previewing ? previewDeps : container.admin,
      enterPreview: () => setPreview(true),
      exitPreview: () => setPreview(false),
    }),
    [previewing, role, setPreview],
  );
  return <AdminViewContext.Provider value={value}>{children}</AdminViewContext.Provider>;
}

export function useAdminView(): AdminViewValue {
  const value = useContext(AdminViewContext);
  if (!value) throw new Error("useAdminView precisa estar dentro de AdminViewProvider.");
  return value;
}

/** Repositórios que a tela deve usar: os reais ou os do modo visualização. */
export const useAdminDeps = (): AdminDeps => useAdminView().deps;

/** Papel que decide menu e telas (no modo visualização, o do Jota). */
export const useViewRole = (): AdminRole | null => useAdminView().viewRole;
