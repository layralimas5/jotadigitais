import { KeyRound, Lock, MailCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { container } from "@/app/container";
import { affiliateSignInSchema, signInAffiliate } from "@/application/affiliate-use-cases";
import { fieldErrorsOf } from "@/application/schemas";
import { DEMO_AFFILIATE_LOGIN } from "@/infrastructure/demo/demo-affiliates";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { Logo } from "@/ui/components/Logo";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { AffiliateSpinner } from "../AffiliateLayout";
import { useAffiliateSession, useAffiliatePortal } from "../session";

type Mode = "sign-in" | "forgot" | "sent";

interface FromState {
  from?: string;
}

const HOME = "/afiliado";

function ForgotForm({ initialEmail, onSent, onBack }: { initialEmail: string; onSent: () => void; onBack: () => void }) {
  const affiliatePortal = useAffiliatePortal();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = affiliateSignInSchema.pick({ email: true }).safeParse({ email });
    if (!parsed.success) {
      setError(fieldErrorsOf(parsed.error).email ?? "Informe um e-mail válido.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await affiliatePortal.requestPasswordReset(parsed.data.email, `${window.location.origin}/afiliado/nova-senha`);
      onSent();
    } catch (reason) {
      console.error(reason);
      setError(reason instanceof Error ? reason.message : "Não foi possível enviar o link agora.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={pending}>
      <TextField label="E-mail" name="email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} error={error ?? undefined} />
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? "Enviando…" : "Enviar link"}
      </Button>
      <button type="button" onClick={onBack} className="w-full text-sm font-medium text-mist hover:text-white">
        Voltar para o login
      </button>
    </form>
  );
}

export default function AffiliateLoginPage() {
  useDocumentMeta("Entrar como afiliado");
  const { state, refresh, portal: affiliatePortal } = useAffiliateSession();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const destination = (location.state as FromState | null)?.from ?? HOME;

  if (state.status === "loading") return <AffiliateSpinner label="Verificando acesso" />;
  if (state.status === "signed-in" && state.me) return <Navigate to={destination} replace />;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = affiliateSignInSchema.safeParse({ email, password });
    setErrors(parsed.success ? {} : fieldErrorsOf(parsed.error));
    if (!parsed.success) return;
    setPending(true);
    setFailure(null);
    try {
      await signInAffiliate(affiliatePortal, { email, password });
      // A sessão recarrega a ficha e a própria tela leva ao painel (ou avisa se o login não é de afiliado).
      refresh();
    } catch (reason) {
      console.error(reason);
      setFailure(reason instanceof Error ? reason.message : "Não foi possível entrar agora.");
    } finally {
      setPending(false);
    }
  };

  const title = mode === "sign-in" ? "Painel do afiliado" : mode === "forgot" ? "Recuperar senha" : "Confira o seu e-mail";

  return (
    <main id="conteudo" className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-electric/20 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <Link to="/" aria-label="Ir para a loja">
            <Logo size="md" />
          </Link>
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-7">
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            {mode === "sign-in" ? <Lock aria-hidden className="size-5 text-electric" /> : mode === "forgot" ? <KeyRound aria-hidden className="size-5 text-electric" /> : <MailCheck aria-hidden className="size-5 text-electric" />}
            {title}
          </h1>

          {mode === "sent" && (
            <div className="mt-3 space-y-5">
              <p className="text-sm text-fog">Se o e-mail tiver cadastro, chega um link para criar uma senha nova. Olhe também o spam.</p>
              <Button variant="secondary" className="w-full" onClick={() => setMode("sign-in")}>
                Voltar para o login
              </Button>
            </div>
          )}
          {mode === "forgot" && (
            <>
              <p className="mt-1.5 text-sm text-mist">Enviamos um link para você criar uma senha nova.</p>
              <ForgotForm initialEmail={email} onSent={() => setMode("sent")} onBack={() => setMode("sign-in")} />
            </>
          )}
          {mode === "sign-in" && (
            <>
              <p className="mt-1.5 text-sm text-mist">Seus links, vendas e comissões.</p>
              {state.status === "signed-in" && !state.me && (
                <p role="alert" className="mt-4 rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-[#ffb4b4]">
                  O e-mail {state.email} não tem cadastro de afiliado.
                </p>
              )}
              <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={pending}>
                <TextField
                  label="E-mail"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  error={errors.email}
                />
                <div>
                  <PasswordField label="Senha" name="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} />
                  <div className="mt-2 flex justify-end">
                    <button type="button" onClick={() => setMode("forgot")} className="rounded-md text-sm font-medium text-electric hover:text-white focus-visible:outline-2 focus-visible:outline-electric">
                      Esqueceu sua senha?
                    </button>
                  </div>
                </div>
                {failure && (
                  <p role="alert" className="rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-[#ffb4b4]">
                    {failure}
                  </p>
                )}
                <Button type="submit" size="lg" className="w-full" disabled={pending}>
                  {pending ? "Entrando…" : "Entrar"}
                </Button>
              </form>
              {container.mode === "demo" && (
                <p className="mt-4 rounded-xl border border-line bg-ink/60 px-4 py-3 text-xs text-mist">
                  Demonstração: {DEMO_AFFILIATE_LOGIN.email} / {DEMO_AFFILIATE_LOGIN.password}
                </p>
              )}
            </>
          )}
        </div>
        <p className="mt-6 text-center text-sm text-mist">
          Ainda não é afiliado?{" "}
          <Link to="/seja-afiliado" className="font-medium text-electric hover:text-white">
            Cadastre-se
          </Link>
        </p>
      </div>
    </main>
  );
}
