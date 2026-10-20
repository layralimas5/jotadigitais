import { MailCheck, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { listAdminUsers, requestPasswordReset } from "@/application/admin-use-cases";
import type { AdminSession } from "@/application/ports";
import type { PasswordResetInput } from "@/application/schemas";
import { sameEmail, type AdminUser } from "@/domain/admin-user";
import { Button } from "@/ui/components/Button";
import { FormSection, InlineError } from "../components/AdminUi";
import { SelectField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { settingsUrl } from "./settings-links";

interface Option {
  value: string;
  label: string;
}

function optionsOf(users: readonly AdminUser[], session: AdminSession): Option[] {
  const you: Option = { value: session.email, label: `Você (${session.email})` };
  const others = users
    .filter((user) => !sameEmail(user.email, session.email))
    .map((user) => ({ value: user.email, label: user.name ? `${user.name} (${user.email})` : user.email }));
  return [you, ...others];
}

/** Manda o link de "criar senha nova" para você ou para alguém da equipe que esqueceu a senha. */
export function PasswordResetSection({ session }: { session: AdminSession }) {
  const users = useAdminQuery(listAdminUsers, "admin-users");
  const options = optionsOf(users.status === "success" ? users.data : [], session);
  const [email, setEmail] = useState(session.email);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const send = useMutation(async (deps, input: PasswordResetInput) => {
    await requestPasswordReset(deps, input, settingsUrl());
    return true;
  });

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSentTo(null);
    const done = await send.run({ email });
    if (done) setSentTo(email);
  };

  return (
    <FormSection
      title="Redefinir senha por e-mail"
      description="Envia um link para criar uma senha nova. Quem recebe entra direto nesta tela, sem precisar da senha antiga."
    >
      <form noValidate onSubmit={onSubmit} aria-busy={send.pending} className="space-y-4">
        <SelectField
          label="Enviar para"
          name="resetEmail"
          value={email}
          options={options}
          onChange={(event) => {
            setEmail(event.target.value);
            setSentTo(null);
          }}
        />
        {sentTo && (
          <p role="status" className="flex gap-3 rounded-2xl border border-electric/30 bg-electric/[0.07] px-4 py-3 text-sm text-white">
            <MailCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-electric" />
            <span>
              Link enviado para <strong className="break-all">{sentTo}</strong>. Ele vale por uma hora; peça para conferir o spam.
            </span>
          </p>
        )}
        {send.error && <InlineError message={send.error.message} />}
        <Button type="submit" variant="secondary" disabled={send.pending} className="max-sm:w-full">
          <Send aria-hidden className="size-4" />
          {send.pending ? "Enviando…" : "Enviar link"}
        </Button>
      </form>
    </FormSection>
  );
}
