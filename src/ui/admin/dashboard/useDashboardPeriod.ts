import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_DASHBOARD_PERIOD, parsePeriod, samePeriod, serializePeriod, type DashboardPeriod } from "@/domain/dashboard-period";

const PARAM = "periodo";

/**
 * O período escolhido mora na URL: recarregar a página ou mandar o link mantém o filtro.
 * `fallback` é o período quando a URL não diz nenhum (o Dashboard abre no mês; Finalizados, em tudo).
 */
export function useDashboardPeriod(fallback: DashboardPeriod = DEFAULT_DASHBOARD_PERIOD) {
  const [params, setParams] = useSearchParams();
  const raw = params.get(PARAM);
  const period = useMemo(() => parsePeriod(raw, fallback), [raw, fallback]);

  const setPeriod = useCallback(
    (next: DashboardPeriod) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (samePeriod(next, fallback)) updated.delete(PARAM);
          else updated.set(PARAM, serializePeriod(next));
          return updated;
        },
        { replace: true },
      );
    },
    [setParams, fallback],
  );

  return [period, setPeriod] as const;
}
