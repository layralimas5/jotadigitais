import { LogOut, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { updateProfile } from "@/application/admin-use-cases";
import type { AdminSession } from "@/application/ports";
import { ValidationError, type ProfileInput } from "@/application/schemas";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, InlineError } from "../components/AdminUi";
import { PersonAvatar } from "../components/PersonAvatar";
import { useMutation } from "../hooks";
import { useAdminSession } from "../session";
import { useToast } from "../toast";
import { HAS_REAL_AUTH, settingsUrl } from "./settings-links";

const EMAIL_HINT = HAS_REAL_AUTH
  ? "Ao trocar, o e-mail novo só vale depois de confirmado pelo link que chega nele."
  : undefined;

export function ProfileSection({ session }: { session: AdminSession }) {
  const toast = useToast();
  const { refresh, signOut } = useAdminSession();
  const [values, setValues] = useState<ProfileInput>({ name: session.name ?? "", email: session.email });
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const save = useMutation((deps, input: ProfileInput) => updateProfile(deps, input, settingsUrl()));
  const fieldErrors = save.error instanceof ValidationError ? save.error.fieldErrors : {};
  const displayName = session.name ?? session.email;

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = await save.run(values);
    if (!result) return;
    await refresh();
    if (result.emailConfirmationPending) {
      setPendingEmail(values.email.trim().toLowerCase());
      setValues((current) => ({ ...current, email: session.email }));
      toast.show("Perfil salvo. Confirme o e-mail novo pelo link que enviamos para ele.");
      return;
    }
    toast.show("Perfil salvo.");
  };

  return (
    <FormSection title="Perfil" description="Seu nome aparece no menu do topo e na lista de usuários.">
      <div className="flex flex-wrap items-center gap-4">
        <PersonAvatar name={displayName} className="size-12 text-sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-white">{displayName}</p>
          <p className="truncate text-xs text-mist">{session.email}</p>
        </div>
        <Button variant="secondary" onClick={() => void signOut()} className="max-sm:w-full">
          <LogOut aria-hidden className="size-4" /> Sair do sistema
        </Button>
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="space-y-4 border-t border-line pt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Nome"
            name="name"
            autoComplete="name"
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            error={fieldErrors.name}
          />
          <TextField
            label="E-mail de acesso"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
            hint={EMAIL_HINT}
            error={fieldErrors.email}
          />
        </div>
        {pendingEmail && (
          <p role="status" className="rounded-2xl border border-electric/30 bg-electric/[0.07] px-4 py-3 text-sm text-white">
            Esperando a confirmação de <strong className="break-all">{pendingEmail}</strong>. Até lá, o login continua com{" "}
            <span className="break-all">{session.email}</span>.
          </p>
        )}
        {save.error && !(save.error instanceof ValidationError) && <InlineError message={save.error.message} />}
        <Button type="submit" disabled={save.pending} className="max-sm:w-full">
          <Save aria-hidden className="size-4" />
          {save.pending ? "Salvando…" : "Salvar perfil"}
        </Button>
      </form>
    </FormSection>
  );
}
