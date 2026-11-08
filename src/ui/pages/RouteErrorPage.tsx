import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouteError } from "react-router-dom";
import { isOutdatedBuildError, reloadForNewVersion } from "@/app/new-version";
import { Button } from "@/ui/components/Button";

/** Erro numa tela (site ou painel): versão nova recarrega sozinha; o resto vira uma mensagem com como seguir. */
export default function RouteErrorPage() {
  const error = useRouteError();
  const outdated = isOutdatedBuildError(error);
  const [reloading, setReloading] = useState(false);

  useEffect(() => {
    console.error(error);
    if (outdated && reloadForNewVersion()) setReloading(true);
  }, [error, outdated]);

  return (
    <main className="grid min-h-dvh place-items-center bg-ink px-4 text-center">
      <div className="max-w-md">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">
          {outdated ? "Versão nova no ar" : "Algo deu errado"}
        </p>
        <h1 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
          {reloading ? "Atualizando a página…" : outdated ? "O sistema foi atualizado" : "Não foi possível abrir esta tela"}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-mist">
          {outdated
            ? "Esta aba ainda estava com a versão anterior. Recarregue para continuar de onde parou."
            : "Recarregue a página. Se continuar, avise no Suporte contando o que você clicou."}
        </p>
        {!reloading && (
          <Button className="mt-6" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden className="size-4" /> Recarregar
          </Button>
        )}
      </div>
    </main>
  );
}
