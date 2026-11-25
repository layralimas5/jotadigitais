import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { container } from "@/app/container";
import type { AffiliatePortalService } from "@/application/affiliate-ports";
import type { AffiliateMe } from "@/domain/affiliate";

export const AFFILIATE_BASE_PATH = "/afiliado";

/** Telas do painel do afiliado ("" = início). */
export type AffiliatePage = "" | "divulgar" | "brindes" | "extrato" | "perfil";

export type AffiliateSessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "error"; message: string }
  /** `me` nulo: o login existe, mas não é de afiliado (ex.: alguém da equipe da loja). */
  | { status: "signed-in"; email: string; me: AffiliateMe | null };

/** Visualização pela equipe: as telas do afiliado, só leitura, com o caminho de volta para o painel. */
export interface AffiliatePreview {
  backPath: string;
}

interface AffiliateSessionValue {
  state: AffiliateSessionState;
  portal: AffiliatePortalService;
  /** Onde as telas do afiliado moram: /afiliado, ou o endereço da visualização. */
  basePath: string;
  preview: AffiliatePreview | null;
  /** Busca de novo a ficha (depois de salvar o perfil, por exemplo). */
  refresh: () => void;
  signOut: () => Promise<void>;
}

const AffiliateSessionContext = createContext<AffiliateSessionValue | null>(null);

async function loadState(portal: AffiliatePortalService): Promise<AffiliateSessionState> {
  const auth = await portal.getAuthState();
  if (auth.status === "signed-out") return auth;
  return { status: "signed-in", email: auth.email, me: await portal.loadMe() };
}

interface ProviderProps {
  children: ReactNode;
  portal?: AffiliatePortalService;
  basePath?: string;
  preview?: AffiliatePreview | null;
}

export function AffiliateSessionProvider({ children, portal = container.affiliates.portal, basePath = AFFILIATE_BASE_PATH, preview = null }: ProviderProps) {
  const [state, setState] = useState<AffiliateSessionState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    loadState(portal).then(
      (next) => !cancelled && setState(next),
      (error: unknown) => {
        console.error(error);
        if (!cancelled) setState({ status: "error", message: "Não deu para abrir o painel agora. Confira a internet e tente de novo." });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, portal]);

  // Entrou ou saiu (inclusive em outra aba): carrega a ficha de novo.
  useEffect(() => portal.onAuthChange(() => setAttempt((value) => value + 1)), [portal]);

  const refresh = useCallback(() => setAttempt((value) => value + 1), []);
  const signOut = useCallback(async () => {
    await portal.signOut();
    setState({ status: "signed-out" });
  }, [portal]);

  const value = useMemo(() => ({ state, portal, basePath, preview, refresh, signOut }), [state, portal, basePath, preview, refresh, signOut]);
  return <AffiliateSessionContext.Provider value={value}>{children}</AffiliateSessionContext.Provider>;
}

export function useAffiliateSession(): AffiliateSessionValue {
  const value = useContext(AffiliateSessionContext);
  if (!value) throw new Error("useAffiliateSession fora do AffiliateSessionProvider");
  return value;
}

export const useAffiliatePortal = (): AffiliatePortalService => useAffiliateSession().portal;

/** Endereço de uma tela do afiliado ("" = início), dentro do painel ou da visualização. */
export function useAffiliatePath(): (page: AffiliatePage) => string {
  const { basePath } = useAffiliateSession();
  return (page) => (page ? `${basePath}/${page}` : basePath);
}

/** Ficha do afiliado logado. Só use dentro das telas protegidas (o layout garante que existe). */
export function useAffiliateMe(): AffiliateMe {
  const { state } = useAffiliateSession();
  if (state.status !== "signed-in" || !state.me) throw new Error("useAffiliateMe sem afiliado logado");
  return state.me;
}
