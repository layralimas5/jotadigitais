import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { DEFAULT_DASHBOARD_PERIOD, parsePeriod, samePeriod, serializePeriod, type DashboardPeriod } from "@/domain/dashboard-period";

const PARAM = "periodo";

/** O período escolhido mora na URL: recarregar a página ou mandar o link mantém o filtro. */
export function useDashboardPeriod() {
  const [params, setParams] = useSearchParams();
  const raw = params.get(PARAM);
  const period = useMemo(() => parsePeriod(raw), [raw]);

  const setPeriod = useCallback(
    (next: DashboardPeriod) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current);
          if (samePeriod(next, DEFAULT_DASHBOARD_PERIOD)) updated.delete(PARAM);
          else updated.set(PARAM, serializePeriod(next));
          return updated;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  return [period, setPeriod] as const;
}
