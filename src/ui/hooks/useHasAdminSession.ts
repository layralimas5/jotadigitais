import { useEffect, useState } from "react";
import { container } from "@/app/container";
import type { AuthState } from "@/application/ports";

/**
 * Quem já entrou no painel neste navegador (inclusive faltando só o código das duas etapas).
 * Visitante sem login não dispara consulta nenhuma: a sessão é lida do próprio navegador.
 */
export function useHasAdminSession(): boolean {
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    let active = true;
    const { auth } = container.admin;
    const apply = (state: AuthState) => {
      if (active) setHasSession(state.status !== "signed-out");
    };
    auth.getState().then(apply, (error: unknown) => console.error(error));
    const unsubscribe = auth.onChange(apply);
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  return hasSession;
}
