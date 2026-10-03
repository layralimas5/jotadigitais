import { Search } from "lucide-react";
import { useDeferredValue, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import type { AccountFilter, AccountSort } from "@/application/ports";
import { NICHES, type Niche } from "@/domain/account";
import { Button } from "@/ui/components/Button";
import { AccountCard, AccountCardSkeleton } from "@/ui/components/account/AccountCard";
import { Reveal, RevealItem } from "@/ui/components/Reveal";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useAccounts } from "@/ui/hooks/useStore";
import { cn } from "@/ui/lib/cn";

const FOLLOWER_RANGES = {
  todas: { label: "Todas", min: undefined, max: undefined },
  "ate-1500": { label: "Até 1,5 mil", min: undefined, max: 1500 },
  "1500-2000": { label: "1,5 a 2 mil", min: 1500, max: 2000 },
  "2000-mais": { label: "2 mil ou mais", min: 2000, max: undefined },
} as const satisfies Record<string, { label: string; min: number | undefined; max: number | undefined }>;

type RangeKey = keyof typeof FOLLOWER_RANGES;

const SORT_OPTIONS: Record<AccountSort, string> = {
  recent: "Mais recentes",
  "price-asc": "Menor preço",
  "followers-desc": "Mais seguidores",
};

function isNiche(value: string | null): value is Niche {
  return value !== null && (NICHES as readonly string[]).includes(value);
}

function isRange(value: string | null): value is RangeKey {
  return value !== null && value in FOLLOWER_RANGES;
}

function isSort(value: string | null): value is AccountSort {
  return value !== null && value in SORT_OPTIONS;
}

function useCatalogParams() {
  const [params, setParams] = useSearchParams();
  const query = params.get("busca") ?? "";
  const nicheParam = params.get("nicho");
  const rangeParam = params.get("seguidores");
  const sortParam = params.get("ordem");
  const niche = isNiche(nicheParam) ? nicheParam : undefined;
  const range: RangeKey = isRange(rangeParam) ? rangeParam : "todas";
  const sort: AccountSort = isSort(sortParam) ? sortParam : "recent";

  const update = (key: string, value: string | undefined) => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  return { query, niche, range, sort, update, reset: () => setParams({}, { replace: true }) };
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors",
        active
          ? "border-electric bg-electric/15 text-white"
          : "border-line-strong text-mist hover:border-white/25 hover:text-white",
      )}
    >
      {children}
    </button>
  );
}

export default function CatalogPage() {
  useDocumentMeta(
    "Contas de TikTok disponíveis",
    "Escolha uma conta de TikTok com o TikTok Shop liberado. Filtre por nicho e número de seguidores.",
  );
  const { query, niche, range, sort, update, reset } = useCatalogParams();
  const deferredQuery = useDeferredValue(query);

  const filter = useMemo<AccountFilter>(
    () => ({
      query: deferredQuery || undefined,
      niche,
      minFollowers: FOLLOWER_RANGES[range].min,
      maxFollowers: FOLLOWER_RANGES[range].max,
      sort,
    }),
    [deferredQuery, niche, range, sort],
  );
  const accounts = useAccounts(filter);
  const hasFilters = Boolean(query || niche || range !== "todas");
  const availableCount =
    accounts.status === "success" ? accounts.data.filter((account) => account.status === "available").length : null;

  return (
    <div className="relative pt-28 pb-24 md:pt-36">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-violet/20 to-transparent" />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <header className="max-w-2xl">
          <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">Vitrine</p>
          <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white md:text-6xl">
            Contas de TikTok
          </h1>
          <p className="mt-4 text-mist md:text-lg">
            Todas com a Central de Criadores do TikTok Shop liberada. Cada conta é única.
          </p>
        </header>

        <div className="sticky top-16 z-30 -mx-4 mt-10 border-b border-line bg-black/80 px-4 py-4 backdrop-blur-xl sm:-mx-6 sm:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Buscar conta</span>
              <Search aria-hidden className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-mist" />
              <input
                type="search"
                value={query}
                onChange={(event) => update("busca", event.target.value || undefined)}
                placeholder="Buscar por nome, @ ou nicho"
                className="h-11 w-full rounded-full border border-line-strong bg-surface pr-4 pl-11 text-sm text-white placeholder:text-mist focus:border-electric focus:outline-none"
              />
            </label>
            <div className="flex gap-3">
              <label className="flex-1 lg:flex-none">
                <span className="sr-only">Seguidores</span>
                <select
                  value={range}
                  onChange={(event) => update("seguidores", event.target.value === "todas" ? undefined : event.target.value)}
                  className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-white focus:border-electric focus:outline-none"
                >
                  {Object.entries(FOLLOWER_RANGES).map(([key, option]) => (
                    <option key={key} value={key}>
                      {key === "todas" ? "Seguidores: todas" : option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex-1 lg:flex-none">
                <span className="sr-only">Ordenar</span>
                <select
                  value={sort}
                  onChange={(event) => update("ordem", event.target.value === "recent" ? undefined : event.target.value)}
                  className="h-11 w-full rounded-full border border-line-strong bg-surface px-4 text-sm text-white focus:border-electric focus:outline-none"
                >
                  {Object.entries(SORT_OPTIONS).map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div role="group" aria-label="Filtrar por nicho" className="mt-3 -mb-1 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
            <FilterChip active={!niche} onClick={() => update("nicho", undefined)}>
              Todos
            </FilterChip>
            {NICHES.map((option) => (
              <FilterChip key={option} active={niche === option} onClick={() => update("nicho", option)}>
                {option}
              </FilterChip>
            ))}
          </div>
        </div>

        <p className="mt-8 text-sm text-mist" aria-live="polite">
          {availableCount === null
            ? "Carregando contas…"
            : `${availableCount} ${availableCount === 1 ? "conta disponível" : "contas disponíveis"}`}
        </p>

        <div className="mt-6">
          {accounts.status === "loading" && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-busy="true">
              {Array.from({ length: 6 }, (_, index) => (
                <AccountCardSkeleton key={index} />
              ))}
            </div>
          )}
          {accounts.status === "error" && <ErrorState message={accounts.error.message} onRetry={accounts.retry} />}
          {accounts.status === "success" && accounts.data.length === 0 && (
            <EmptyState
              title="Nenhuma conta com esses filtros"
              description="Tente outro nicho ou outra faixa de seguidores. Entram contas novas toda semana."
              action={
                hasFilters ? (
                  <Button variant="secondary" onClick={reset}>
                    Limpar filtros
                  </Button>
                ) : undefined
              }
            />
          )}
          {accounts.status === "success" && accounts.data.length > 0 && (
            <Reveal as="ul" stagger key={JSON.stringify(filter)} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {accounts.data.map((account) => (
                <RevealItem as="li" key={account.id}>
                  <AccountCard account={account} />
                </RevealItem>
              ))}
            </Reveal>
          )}
        </div>
      </div>
    </div>
  );
}
