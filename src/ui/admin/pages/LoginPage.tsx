import { KeyRound, Lock } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { signIn } from "@/application/admin-use-cases";
import { ValidationError } from "@/application/schemas";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { Logo } from "@/ui/components/Logo";
import { InlineError, LoadingBlock } from "../components/AdminUi";
import { ForgotPasswordForm } from "../components/ForgotPasswordForm";
import { useMutation } from "../hooks";
import { HOME_PATH } from "../navigation";
import { useAdminSession } from "../session";

interface FromState {
  from?: string;
}

type Mode = "sign-in" | "forgot-password";

export default function LoginPage() {
  const { state } = useAdminSession();
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const login = useMutation(signIn);
  const destination = (location.state as FromState | null)?.from ?? HOME_PATH;

  if (state.status === "loading") return <LoadingBlock label="Verificando acesso" />;
  if (state.status === "signed-in") return <Navigate to={destination} replace />;

  const fieldErrors = login.error instanceof ValidationError ? login.error.fieldErrors : {};
  const forgotPassword = mode === "forgot-password";

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const session = await login.run({ email, password });
    if (session) navigate(destination, { replace: true });
  };

  return (
    <main id="conteudo" className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[36rem] -translate-x-1/2 rounded-full bg-violet/30 blur-[120px]" />
      <div className="relative w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        <div className="mt-8 rounded-3xl border border-line bg-surface p-6 sm:p-7">
          <h1 className="flex items-center gap-2 font-display text-xl font-semibold text-white">
            {forgotPassword ? (
              <KeyRound aria-hidden className="size-5 text-electric" />
            ) : (
              <Lock aria-hidden className="size-5 text-electric" />
            )}
            {forgotPassword ? "Recuperar senha" : "Entrar no painel"}
          </h1>
          <p className="mt-1.5 text-sm text-mist">
            {forgotPassword
              ? "Informe o e-mail de acesso e enviamos um link para criar uma senha nova."
              : "Área restrita para cadastrar contas, depoimentos e acompanhar pedidos."}
          </p>

          {forgotPassword ? (
            <ForgotPasswordForm initialEmail={email} onBack={() => setMode("sign-in")} />
          ) : (
            <form noValidate onSubmit={onSubmit} className="mt-6 space-y-4" aria-busy={login.pending}>
              <TextField
                label="E-mail"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                error={fieldErrors.email}
              />
              <div>
                <TextField
                  label="Senha"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  error={fieldErrors.password}
                />
                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setMode("forgot-password")}
                    className="rounded-md text-sm font-medium text-electric transition-colors hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              </div>
              {login.error && !(login.error instanceof ValidationError) && <InlineError message={login.error.message} />}
              <Button type="submit" size="lg" className="w-full" disabled={login.pending}>
                {login.pending ? "Entrando…" : "Entrar"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
