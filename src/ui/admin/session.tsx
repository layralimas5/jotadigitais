import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import type { AuthState } from "@/application/ports";

type SessionState = { status: "loading" } | AuthState;

interface SessionContextValue {
  state: SessionState;
  signOut: () => Promise<void>;
  /** Relê a sessão depois de mudanças que não disparam evento de login (ex.: nome do perfil). */
  refresh: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const { auth } = container.admin;

  useEffect(() => {
    let active = true;
    auth.getState().then(
      (next) => active && setState(next),
      (error: unknown) => {
        console.error(error);
        if (active) setState({ status: "signed-out" });
      },
    );
    const unsubscribe = auth.onChange((next) => active && setState(next));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  const value = useMemo<SessionContextValue>(
    () => ({
      state,
      signOut: () => auth.signOut(),
      refresh: async () => setState(await auth.getState()),
    }),
    [state, auth],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useAdminSession precisa estar dentro de AdminSessionProvider.");
  return value;
}
