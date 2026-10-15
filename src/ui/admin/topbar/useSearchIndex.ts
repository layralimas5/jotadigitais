import { useCallback, useRef, useState } from "react";
import { container } from "@/app/container";
import type { SearchItem } from "@/application/search";
import { loadSearchIndex } from "@/application/workspace-use-cases";
import { NAV_GROUPS } from "../navigation";

/** Atalhos de criação e telas fora do menu, além das abas: "nova conta" leva direto ao cadastro. */
const SHORTCUTS: readonly Omit<SearchItem, "group">[] = [
  { id: "page:nova-conta", title: "Nova conta", subtitle: "Cadastrar conta no estoque", to: "/admin/contas/nova" },
  { id: "page:novo-pedido-crm", title: "Novo contato no CRM", subtitle: "Cadastrar lead", to: "/admin/crm/novo" },
  { id: "page:novo-cliente", title: "Novo cliente", subtitle: "Cadastrar cliente", to: "/admin/clientes/novo" },
  { id: "page:nova-despesa", title: "Nova despesa", subtitle: "Lançar no financeiro", to: "/admin/financeiro/despesas/nova" },
  { id: "page:novo-parceiro", title: "Novo parceiro", subtitle: "Cadastrar fornecedor", to: "/admin/parceiros/novo" },
  { id: "page:novo-depoimento", title: "Novo depoimento", subtitle: "Enviar print de resultado", to: "/admin/depoimentos/novo" },
  { id: "page:novo-usuario", title: "Novo usuário", subtitle: "Dar acesso ao sistema", to: "/admin/usuarios/novo" },
  { id: "page:minha-conta", title: "Minha conta", subtitle: "Trocar senha", to: "/admin/minha-conta", keywords: "senha perfil sair" },
];

export const PAGE_ITEMS: readonly SearchItem[] = [
  ...NAV_GROUPS.flatMap((group) =>
    group.items.map<SearchItem>((item) => ({
      id: `page:${item.to}`,
      group: "page",
      title: item.label,
      subtitle: item.description,
      to: item.to,
      keywords: group.label ?? "",
    })),
  ),
  ...SHORTCUTS.map<SearchItem>((item) => ({ ...item, group: "page" })),
];

const STALE_MS = 30_000;

type IndexState = { status: "idle" | "loading" | "error"; records: SearchItem[] } | { status: "ready"; records: SearchItem[] };

/** Contas, pedidos, clientes... carregados quando a busca recebe foco e recarregados se ficarem velhos. */
export function useSearchIndex() {
  const [state, setState] = useState<IndexState>({ status: "idle", records: [] });
  const loadedAt = useRef(0);
  const loading = useRef(false);

  const ensureLoaded = useCallback(async () => {
    if (loading.current || Date.now() - loadedAt.current < STALE_MS) return;
    loading.current = true;
    setState((current) => ({ ...current, status: current.status === "ready" ? "ready" : "loading" }));
    try {
      const records = await loadSearchIndex(container.admin);
      loadedAt.current = Date.now();
      setState({ status: "ready", records });
    } catch (error) {
      console.error("Falha ao carregar a busca", error);
      setState((current) => ({ ...current, status: "error" }));
    } finally {
      loading.current = false;
    }
  }, []);

  return { ...state, ensureLoaded };
}
