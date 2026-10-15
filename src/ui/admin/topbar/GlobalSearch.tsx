import { CornerDownLeft, Search, X } from "lucide-react";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { SEARCH_GROUPS, SEARCH_GROUP_LABEL, searchItems, type SearchItem } from "@/application/search";
import { cn } from "@/ui/lib/cn";
import { useCloseOnOutsideClick } from "../lib/use-close-on-outside";
import { PAGE_ITEMS, useSearchIndex } from "./useSearchIndex";

/** Com o campo vazio, sugere as telas mais usadas. */
const SUGGESTED = PAGE_ITEMS.filter((item) =>
  ["/admin/contas", "/admin/pedidos", "/admin/crm", "/admin/contas/nova", "/admin/finalizados", "/admin/apis"].includes(item.to),
);

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

interface GlobalSearchProps {
  /** No celular a busca abre numa tela própria, já com o cursor no campo. */
  autoFocus?: boolean;
  /** Atalho Ctrl+K (⌘K no Mac). Só um campo da tela deve escutar. */
  withShortcut?: boolean;
  onNavigate?: () => void;
  className?: string;
}

function ResultGroups({ results, activeId, optionId, onPick, onHover }: {
  results: SearchItem[];
  activeId: string | null;
  /** Id único no DOM a partir de um texto (id do resultado ou nome do grupo). */
  optionId: (raw: string) => string;
  onPick: (item: SearchItem) => void;
  onHover: (item: SearchItem) => void;
}) {
  return (
    <>
      {SEARCH_GROUPS.map((group) => {
        const items = results.filter((item) => item.group === group);
        if (items.length === 0) return null;
        const labelId = optionId(`group-${group}`);
        return (
          <div key={group} role="group" aria-labelledby={labelId} className="py-1">
            <p id={labelId} className="px-3 pt-1.5 pb-1 text-[0.65rem] font-semibold tracking-[0.14em] text-mist/80 uppercase">
              {SEARCH_GROUP_LABEL[group]}
            </p>
            {items.map((item) => {
              const active = item.id === activeId;
              return (
                <div
                  key={item.id}
                  id={optionId(item.id)}
                  role="option"
                  aria-selected={active}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => onPick(item)}
                  onMouseMove={() => onHover(item)}
                  className={cn("flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2", active ? "bg-electric/12" : "hover:bg-white/[0.04]")}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-white">{item.title}</span>
                    <span className="block truncate text-xs text-mist">{item.subtitle}</span>
                  </span>
                  {active && <CornerDownLeft aria-hidden className="size-3.5 shrink-0 text-electric-soft" />}
                </div>
              );
            })}
          </div>
        );
      })}
    </>
  );
}

/** Campo de busca do topo: encontra telas, contas, pedidos, clientes, contatos do CRM e parceiros. */
export function GlobalSearch({ autoFocus = false, withShortcut = false, onNavigate, className }: GlobalSearchProps) {
  const navigate = useNavigate();
  const index = useSearchIndex();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(autoFocus);
  const [activeIndex, setActiveIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const baseId = useId();

  const close = useCallback(() => setOpen(false), []);
  useCloseOnOutsideClick(open, close, rootRef);

  const results = useMemo(
    () => (query.trim() ? searchItems([...PAGE_ITEMS, ...index.records], query) : SUGGESTED),
    [query, index.records],
  );
  const optionId = useCallback((raw: string) => `${baseId}-${raw.replace(/[^a-zA-Z0-9_-]/g, "_")}`, [baseId]);
  const active = results[Math.min(activeIndex, results.length - 1)] ?? null;

  useEffect(() => setActiveIndex(0), [query]);

  const { ensureLoaded } = index;
  /** Quem abre a busca no celular já quer digitar: carrega os registros na hora. */
  useEffect(() => {
    if (autoFocus) void ensureLoaded();
  }, [autoFocus, ensureLoaded]);

  useEffect(() => {
    if (!withShortcut) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.ctrlKey || event.metaKey)) {
        event.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [withShortcut]);

  useEffect(() => {
    if (active) document.getElementById(optionId(active.id))?.scrollIntoView({ block: "nearest" });
  }, [active, optionId]);

  const pick = (item: SearchItem) => {
    navigate(item.to);
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onNavigate?.();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    switch (event.key) {
      case "ArrowDown":
        setOpen(true);
        setActiveIndex((current) => Math.min(current + 1, results.length - 1));
        break;
      case "ArrowUp":
        setActiveIndex((current) => Math.max(current - 1, 0));
        break;
      case "Enter":
        if (open && active) pick(active);
        break;
      case "Escape":
        if (query) setQuery("");
        else {
          setOpen(false);
          inputRef.current?.blur();
        }
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  const showList = open && (results.length > 0 || query.trim().length > 0);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-mist" />
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-label="Buscar no sistema"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && active ? optionId(active.id) : undefined}
        autoFocus={autoFocus}
        autoComplete="off"
        spellCheck={false}
        value={query}
        placeholder="Buscar conta, pedido, cliente ou tela…"
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          void ensureLoaded();
        }}
        onKeyDown={onKeyDown}
        className="h-10 w-full rounded-full border border-line-strong bg-surface pr-20 pl-10 text-sm text-white placeholder:text-mist focus:border-electric focus:outline-none"
      />
      {query ? (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            inputRef.current?.focus();
          }}
          aria-label="Limpar busca"
          className="absolute top-1/2 right-2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-mist hover:bg-white/[0.08] hover:text-white"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      ) : (
        withShortcut && (
          <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded-md border border-line-strong px-1.5 py-0.5 font-sans text-[0.65rem] text-mist md:block">
            {isMac() ? "⌘" : "Ctrl"} K
          </kbd>
        )
      )}

      {showList && (
        <div
          id={listId}
          role="listbox"
          aria-label="Resultados da busca"
          className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(26rem,calc(100dvh-7rem))] overflow-y-auto rounded-2xl border border-line-strong bg-surface p-1.5 shadow-2xl shadow-black/60"
        >
          {!query.trim() && <p className="px-3 pt-1.5 pb-1 text-[0.65rem] font-semibold tracking-[0.14em] text-mist/80 uppercase">Atalhos</p>}
          {results.length > 0 ? (
            <ResultGroups results={results} activeId={active?.id ?? null} optionId={optionId} onPick={pick} onHover={(item) => setActiveIndex(results.indexOf(item))} />
          ) : (
            <p className="px-3 py-6 text-center text-sm text-mist">
              {index.status === "loading" ? "Procurando…" : `Nada encontrado para “${query.trim()}”.`}
            </p>
          )}
          {index.status === "error" && (
            <p className="px-3 pb-2 text-xs text-mist">Só as telas aparecem agora: não foi possível carregar os registros.</p>
          )}
        </div>
      )}
    </div>
  );
}
