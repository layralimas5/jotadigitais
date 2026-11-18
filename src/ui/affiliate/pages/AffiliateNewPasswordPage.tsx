import { KeyRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { affiliateNewPasswordSchema, setAffiliatePassword } from "@/application/affiliate-use-cases";
import { fieldErrorsOf, PASSWORD_RULE_HINT } from "@/application/schemas";
import { Button } from "@/ui/components/Button";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { Logo } from "@/ui/components/Logo";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { AffiliateSpinner } from "../AffiliateLayout";
import { affiliatePortal, useAffiliateSession } from "../session";

/** Destino do link "Esqueceu sua senha?": a sessão vem no próprio link e só dá para criar a senha nova. */
export default function AffiliateNewPasswordPage() {
  useDocumentMeta("Nova senha do afiliado");
  const { state, refresh } = useAffiliateSession();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (state.status === "loading") return <AffiliateSpinner label="Conferindo o link" />;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = affiliateNewPasswordSchema.safeParse({ password, confirmation });
    setErrors(parsed.success ? {} : fieldErrorsOf(parsed.error));
    if (!parsed.success) return;
    setPending(true);
    setFailure(null);
    try {
      await setAffiliatePassword(affiliatePortal, { password, confirmation });
      refresh();
      navigate("/afiliado", { replace: true });
    } catch (reason) {
      console.error(reason);
      setFailure(reason instanceof Error ? reason.message : "Não foi possível trocar a senha.");
    } finally {
      setPending(false);
    }
  };

  return (
    <main id="conteudo" className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-7">
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            <KeyRound aria-hidden className="size-5 text-electric" /> Criar senha nova
          </h1>
          {state.status !== "signed-in" ? (
            <div className="mt-3 space-y-5 text-sm text-fog">
              <p>Este link expirou ou já foi usado. Peça outro na tela de login.</p>
              <Link to="/afiliado/entrar" className="font-medium text-electric hover:text-white">
                Ir para o login
              </Link>
            </div>
          ) : (
            <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={pending}>
              <PasswordField
                label="Senha nova"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                error={errors.password}
                hint={PASSWORD_RULE_HINT}
              />
              <PasswordField
                label="Repita a senha"
                name="confirmation"
                autoComplete="new-password"
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                error={errors.confirmation}
              />
              {failure && (
                <p role="alert" className="rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-[#ffb4b4]">
                  {failure}
                </p>
              )}
              <Button type="submit" size="lg" className="w-full" disabled={pending}>
                {pending ? "Salvando…" : "Salvar senha e entrar"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
