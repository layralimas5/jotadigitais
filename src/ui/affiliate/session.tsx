import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import type { AffiliatePortalService } from "@/application/affiliate-ports";
import type { AffiliateMe } from "@/domain/affiliate";

export const affiliatePortal: AffiliatePortalService = container.affiliates.portal;

export type AffiliateSessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  /** `me` nulo: o login existe, mas não é de afiliado (ex.: alguém da equipe da loja). */
  | { status: "signed-in"; email: string; me: AffiliateMe | null };

interface AffiliateSessionValue {
  state: AffiliateSessionState;
  /** Busca de novo a ficha (depois de salvar o perfil, por exemplo). */
  refresh: () => void;
  signOut: () => Promise<void>;
}

const AffiliateSessionContext = createContext<AffiliateSessionValue | null>(null);

async function loadState(): Promise<AffiliateSessionState> {
  const auth = await affiliatePortal.getAuthState();
  if (auth.status === "signed-out") return auth;
  return { status: "signed-in", email: auth.email, me: await affiliatePortal.loadMe() };
}

export function AffiliateSessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AffiliateSessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadState().then(
      (next) => !cancelled && setState(next),
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: "Não deu para abrir o painel agora. Confira a internet e tente de novo." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  // Entrou ou saiu (inclusive em outra aba): carrega a ficha de novo.
  useEffect(() => affiliatePortal.onAuthChange(() => setAttempt((value) => value + 1)), []);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const signOut = useCallback(async () => {
    await affiliatePortal.signOut();
    setState({ status: "signed-out" });
  }, []);

  const value = useMemo(() => ({ state, refresh, signOut }), [state, refresh, signOut]);
  return <AffiliateSessionContext.Provider value={value}>{children}</AffiliateSessionContext.Provider>;
}

export function useAffiliateSession(): AffiliateSessionValue {
  const value = useContext(AffiliateSessionContext);
  if (!value) throw new Error("useAffiliateSession fora do AffiliateSessionProvider");
  return value;
}

/** Ficha do afiliado logado. Só use dentro das telas protegidas (o layout garante que existe). */
export function useAffiliateMe(): AffiliateMe {
  const { state } = useAffiliateSession();
  if (state.status !== "signed-in" || !state.me) throw new Error("useAffiliateMe sem afiliado logado");
  return state.me;
}
