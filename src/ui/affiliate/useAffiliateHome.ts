import { container } from "@/app/container";
import { loadAffiliateHome } from "@/application/affiliate-use-cases";
import { useAsync } from "@/ui/hooks/useAsync";
import { useAffiliateMe, useAffiliatePortal, useAffiliateSession } from "./session";

/**
 * Dados do painel (saldo, pagamento, código de saldo, vitrine). `reload` relê a ficha e os números depois de pedir
 * pagamento ou mexer no código de saldo, sem tirar a tela do lugar.
 */
export function useAffiliateHome() {
  const me = useAffiliateMe();
  const portal = useAffiliatePortal();
  const { refresh } = useAffiliateSession();
  const home = useAsync(() => loadAffiliateHome(portal, container.store, me), `affiliate-home:${me.id}:${me.status}:${me.payoutRequestedAt ?? ""}`, {
    keepPrevious: true,
  });
  const reload = () => {
    refresh();
    home.retry();
  };
  return { home, reload };
}
