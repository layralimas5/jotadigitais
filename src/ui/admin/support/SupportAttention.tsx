import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { listSupportTickets } from "@/application/support-use-cases";
import { newSupportActivity, snapshotOf, type SupportActivity, type SupportSnapshot } from "@/domain/support-activity";
import { needsActionFrom, type SupportRole, type SupportTicket } from "@/domain/support-ticket";
import { useAdminView } from "../admin-view";
import { useAdminQuery, usePolling } from "../hooks";
import { usePushReceived } from "../pwa/usePanelApp";
import { MAX_SUPPORT_TOASTS, SupportActivityToasts } from "./SupportActivityToasts";

/** Curto para o aviso de resposta chegar quase na hora; com a aba escondida não consulta (volta a ler ao reabrir). */
const REFRESH_MS = 20_000;

const SupportAttentionContext = createContext(0);

/**
 * Quantos chamados esperam a ação de quem está logado: para a Lay, pendentes ou com resposta nova do Jota;
 * para o Jota, os que aguardam ele. Uma consulta só para o menu lateral, a barra de baixo e o "Mais".
 */
/** Número no ícone do app instalado (iPhone 16.4+ na Tela de Início, Android e computador). Só para o Jota. */
function useAppIconBadge(count: number, enabled: boolean) {
  useEffect(() => {
    if (!enabled || !("setAppBadge" in navigator)) return;
    const update = count > 0 ? navigator.setAppBadge(count) : navigator.clearAppBadge();
    update.catch((error: unknown) => console.warn("Número no ícone do app não atualizou", error));
  }, [count, enabled]);
}

const ticketIdOf = (pathname: string): string | null => /^\/admin\/suporte\/([^/]+)$/.exec(pathname)?.[1] ?? null;

/**
 * Avisos flutuantes do que a outra pessoa abriu ou respondeu. A primeira leitura só memoriza (abrir o painel não
 * avisa nada antigo) e quem já está com o chamado aberto na tela não recebe aviso dele.
 * No "Ver como" nada aparece: a conversa ali não é da desenvolvedora.
 */
function useSupportActivityToasts(tickets: readonly SupportTicket[] | null, role: SupportRole, enabled: boolean, pathname: string) {
  const [items, setItems] = useState<SupportActivity[]>([]);
  const known = useRef<SupportSnapshot | null>(null);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  });

  useEffect(() => {
    if (!tickets) return;
    const previous = known.current;
    known.current = snapshotOf(tickets);
    if (!previous || !enabled) return;
    const openTicket = ticketIdOf(pathnameRef.current);
    const fresh = newSupportActivity(previous, tickets, role).filter((item) => item.ticketId !== openTicket);
    if (fresh.length) setItems((current) => [...current, ...fresh].slice(-MAX_SUPPORT_TOASTS));
  }, [tickets, role, enabled]);

  const close = useCallback((key: string) => setItems((current) => current.filter((item) => item.key !== key)), []);
  return { items: enabled ? items : [], close };
}

export function SupportAttentionProvider({ role, children }: { role: SupportRole; children: ReactNode }) {
  const tickets = useAdminQuery((deps) => listSupportTickets(deps, role), `support-attention-${role}`);
  const reloadWhenVisible = useCallback(() => {
    if (document.visibilityState === "visible") tickets.reload();
  }, [tickets.reload]);
  usePolling(reloadWhenVisible, REFRESH_MS);
  // Chegou push no aparelho com o painel aberto: lê na hora em vez de esperar a próxima volta.
  usePushReceived(tickets.reload);
  const { mode } = useAdminView();
  // Depois de responder ou mudar a situação a pessoa troca de tela: o número acompanha na hora.
  const { pathname } = useLocation();
  const reloadRef = useRef(tickets.reload);
  useEffect(() => {
    reloadRef.current = tickets.reload;
  });
  useEffect(() => {
    reloadRef.current();
  }, [pathname]);
  const data = tickets.status === "success" ? tickets.data : null;
  const count = useMemo(() => (data ? data.filter((ticket) => needsActionFrom(ticket, role)).length : 0), [data, role]);
  useAppIconBadge(count, role === "admin" && data !== null);
  const toasts = useSupportActivityToasts(data, role, mode === "self", pathname);
  return (
    <SupportAttentionContext.Provider value={count}>
      {children}
      <SupportActivityToasts items={toasts.items} onClose={toasts.close} />
    </SupportAttentionContext.Provider>
  );
}

export const useSupportAttention = (): number => useContext(SupportAttentionContext);

/** Bolinha com o número ao lado de "Suporte". */
export function AttentionCount({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      aria-label={`${count} ${count === 1 ? "chamado precisa" : "chamados precisam"} de você`}
      className={`grid min-w-5 place-items-center rounded-full bg-pink px-1.5 text-[0.68rem] leading-5 font-bold text-ink tabular-nums ${className ?? ""}`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
