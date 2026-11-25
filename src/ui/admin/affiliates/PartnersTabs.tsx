import { useSearchParams } from "react-router-dom";
import { cn } from "@/ui/lib/cn";

export const PARTNERS_TABS = [
  { id: "parceiros", label: "Parceiros" },
  { id: "afiliados", label: "Afiliados" },
  { id: "pagamentos", label: "Pagamentos" },
  { id: "brindes", label: "Brindes" },
  { id: "programa", label: "Programa" },
  { id: "mural", label: "Mural" },
] as const;

export type PartnersTab = (typeof PARTNERS_TABS)[number]["id"];

const TAB_PARAM = "aba";
const DEFAULT_TAB: PartnersTab = "parceiros";

const isPartnersTab = (value: string | null): value is PartnersTab => PARTNERS_TABS.some((tab) => tab.id === value);

/** Aba aberta fica no endereço (?aba=afiliados): o aviso de cadastro novo no sininho já cai nela. */
export function usePartnersTab(): [PartnersTab, (tab: PartnersTab) => void] {
  const [params, setParams] = useSearchParams();
  const requested = params.get(TAB_PARAM);
  const tab = isPartnersTab(requested) ? requested : DEFAULT_TAB;
  const setTab = (next: PartnersTab) => {
    const nextParams = new URLSearchParams(params);
    if (next === DEFAULT_TAB) nextParams.delete(TAB_PARAM);
    else nextParams.set(TAB_PARAM, next);
    setParams(nextParams, { replace: true });
  };
  return [tab, setTab];
}

export const partnersTabPath = (tab: PartnersTab) => (tab === DEFAULT_TAB ? "/admin/parceiros" : `/admin/parceiros?${TAB_PARAM}=${tab}`);

/** Contador em cada aba: afiliados esperando aprovação e afiliados com lote pronto para pagar. */
const BADGE_HINT: Partial<Record<PartnersTab, string>> = { afiliados: "esperando aprovação", pagamentos: "prontos para pagar" };

export function PartnersTabBar({
  tab,
  onChange,
  badges,
}: {
  tab: PartnersTab;
  onChange: (tab: PartnersTab) => void;
  badges: Partial<Record<PartnersTab, number>>;
}) {
  return (
    <div role="tablist" aria-label="Parceiros e afiliados" className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
      {PARTNERS_TABS.map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={tab === item.id}
          onClick={() => onChange(item.id)}
          className={cn(
            "shrink-0 rounded-full border px-4 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric",
            tab === item.id ? "border-electric bg-electric/15 text-white" : "border-line-strong text-mist hover:text-white",
          )}
        >
          {item.label}
          {(badges[item.id] ?? 0) > 0 && (
            <span className="ml-1.5 rounded-full bg-electric/20 px-1.5 text-xs font-semibold text-electric-soft tabular-nums">
              {badges[item.id]}
              <span className="sr-only"> {BADGE_HINT[item.id]}</span>
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
