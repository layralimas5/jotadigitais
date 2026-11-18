import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { container } from "@/app/container";
import { attachAffiliateClick, trackAffiliateVisit, type StoredAffiliateClick } from "@/application/affiliate-use-cases";
import { AFFILIATE_REF_PARAM, parseAffiliateCode } from "@/domain/affiliate";

/** Último link de afiliado aberto neste navegador (o mais recente vale). */
const STORAGE_KEY = "jota:affiliate-click";

function readStoredClick(): StoredAffiliateClick | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { clickId, code, expiresAt } = parsed as Record<string, unknown>;
    if (typeof clickId !== "string" || typeof code !== "string" || typeof expiresAt !== "string") return null;
    return { clickId, code, expiresAt };
  } catch (error) {
    console.warn("Não deu para ler o link de afiliado guardado", error);
    return null;
  }
}

function storeClick(click: StoredAffiliateClick): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(click));
  } catch (error) {
    console.warn("Não deu para guardar o link de afiliado", error);
  }
}

const accountSlugOf = (pathname: string) => /^\/contas\/([^/]+)\/?$/.exec(pathname)?.[1] ?? null;

/**
 * Visitante que chega com ?ref=<código>: conta o clique, guarda por `link_days` e tira o parâmetro do endereço
 * (o link fica limpo para compartilhar de novo). Falha no rastreio nunca atrapalha a navegação.
 */
export function useAffiliateRef(): void {
  const location = useLocation();
  const navigate = useNavigate();
  const tracked = useRef(new Set<string>());

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const raw = params.get(AFFILIATE_REF_PARAM);
    if (raw === null) return;
    params.delete(AFFILIATE_REF_PARAM);
    const search = params.toString();
    navigate({ pathname: location.pathname, search: search ? `?${search}` : "", hash: location.hash }, { replace: true });

    const code = parseAffiliateCode(raw);
    const key = `${code}:${location.pathname}`;
    if (!code || tracked.current.has(key)) return;
    tracked.current.add(key);
    trackAffiliateVisit(container.affiliates.tracking, code, accountSlugOf(location.pathname)).then(
      (click) => click && storeClick(click),
      (error: unknown) => console.warn("Não deu para contar o clique do afiliado", error),
    );
  }, [location.pathname, location.search, location.hash, navigate]);
}

/** Depois do pedido criado: liga ao afiliado do último link aberto, se ainda estiver no prazo. */
export async function attachStoredAffiliateClick(orderCode: string): Promise<void> {
  const click = readStoredClick();
  if (!click) return;
  try {
    await attachAffiliateClick(container.affiliates.tracking, orderCode, click);
  } catch (error) {
    // O pedido já existe; perder a ligação com o afiliado não pode travar o pagamento do cliente.
    console.warn("Não deu para ligar o pedido ao afiliado", error);
  }
}
