import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import type { AdminSession } from "@/application/ports";

type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; session: AdminSession };

interface SessionContextValue {
  state: SessionState;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

const toState = (session: AdminSession | null): SessionState =>
  session ? { status: "signed-in", session } : { status: "signed-out" };

export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });
  const { auth } = container.admin;

  useEffect(() => {
    let active = true;
    auth.getSession().then(
      (session) => active && setState(toState(session)),
      (error: unknown) => {
        console.error(error);
        if (active) setState({ status: "signed-out" });
      },
    );
    const unsubscribe = auth.onChange((session) => active && setState(toState(session)));
    return () => {
      active = false;
      unsubscribe();
    };
  }, [auth]);

  const value = useMemo<SessionContextValue>(() => ({ state, signOut: () => auth.signOut() }), [state, auth]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAdminSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useAdminSession precisa estar dentro de AdminSessionProvider.");
  return value;
}
