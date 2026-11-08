import { container } from "@/app/container";
import { cn } from "@/ui/lib/cn";
import { useAdminView } from "../admin-view";

const IS_DEMO = container.mode === "demo";

/**
 * No modo demonstração e no "Testar como o Jota" os usuários são de exemplo: ninguém consegue entrar com eles.
 * Sem este aviso, quem testa cria um acesso e estranha a senha "incorreta" no login de verdade.
 */
export function ExampleUsersNotice({ className }: { className?: string }) {
  const { testing } = useAdminView();
  if (!IS_DEMO && !testing) return null;
  return (
    <p role="note" className={cn("rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] px-4 py-3 text-sm text-amber-100", className)}>
      {testing ? (
        <>
          <strong className="font-semibold text-white">Ambiente de teste:</strong> os usuários criados aqui são de exemplo e não conseguem entrar no
          sistema. Os acessos de verdade o Jota cria aqui em Usuários, entrando com a conta dele.
        </>
      ) : (
        <>
          <strong className="font-semibold text-white">Modo demonstração:</strong> a lista fica só neste navegador e ninguém consegue entrar com ela.
          Com o banco ligado, cada usuário entra com o próprio e-mail e senha.
        </>
      )}
    </p>
  );
}
