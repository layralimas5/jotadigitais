import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { listSupportTickets } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import { needsActionFrom } from "@/domain/support-ticket";
import { useAdminQuery, usePolling } from "../hooks";

const REFRESH_MS = 60_000;

const SupportAttentionContext = createContext(0);

/**
 * Quantos chamados esperam a ação de quem está logado: para a Lay, pendentes ou com resposta nova do Jota;
 * para o Jota, os que aguardam ele. Uma consulta só para o menu lateral, a barra de baixo e o "Mais".
 */
export function SupportAttentionProvider({ role, children }: { role: AdminRole; children: ReactNode }) {
  const tickets = useAdminQuery(listSupportTickets, "support-attention");
  usePolling(tickets.reload, REFRESH_MS);
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
  return <SupportAttentionContext.Provider value={count}>{children}</SupportAttentionContext.Provider>;
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
