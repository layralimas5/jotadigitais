import { Copy, KeyRound, RefreshCw, Save } from "lucide-react";
import { useState, type FormEvent } from "react";
import { setAccessPassword, updateAccessProfile } from "@/application/access-use-cases";
import { fieldErrorsOf, accessProfileSchema, PASSWORD_RULE_HINT } from "@/application/schemas";
import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import type { AdminRole } from "@/domain/admin-user";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { InlineError } from "../components/AdminUi";
import { Modal } from "../components/Modal";
import { generatePassword } from "../emails/generate-password";
import { useCopy } from "../emails/use-copy";
import { useMutation } from "../hooks";
import { formatPhone } from "../lib/whatsapp";

// ---------------------------------------------------------------------------
// Editar dados
// ---------------------------------------------------------------------------

interface EditFormProps {
  user: AccessUser;
  role: AdminRole;
  onSaved: (update: AccessProfileUpdate) => void;
  onCancel: () => void;
}

function EditForm({ user, role, onSaved, onCancel }: EditFormProps) {
  const [values, setValues] = useState({ name: user.name ?? "", email: user.email, whatsapp: user.whatsapp ? formatPhone(user.whatsapp) : "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const save = useMutation((deps, raw: unknown) => updateAccessProfile(deps, role, user.id, raw));
  const emailChanged = values.email.trim().toLowerCase() !== user.email.toLowerCase();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = { ...values, whatsapp: values.whatsapp || null };
    const result = accessProfileSchema.safeParse(raw);
    if (!result.success) {
      setErrors(fieldErrorsOf(result.error));
      return;
    }
    setErrors({});
    const saved = await save.run(raw);
    if (saved) onSaved(saved);
  };

  return (
    <form noValidate onSubmit={submit} aria-busy={save.pending} className="space-y-4">
      <TextField label="Nome" name="name" autoComplete="off" maxLength={80} value={values.name} onChange={(event) => setValues({ ...values, name: event.target.value })} error={errors.name} />
      <TextField
        label="E-mail de acesso"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        value={values.email}
        onChange={(event) => setValues({ ...values, email: event.target.value })}
        error={errors.email}
        hint={emailChanged ? "O e-mail novo vale na hora: a pessoa passa a entrar com ele, sem precisar confirmar." : undefined}
      />
      <TextField
        label="WhatsApp"
        name="whatsapp"
        inputMode="tel"
        autoComplete="off"
        placeholder="(84) 98122-5361"
        value={values.whatsapp}
        onChange={(event) => setValues({ ...values, whatsapp: event.target.value })}
        error={errors.whatsapp}
        hint="Usado para mandar o acesso."
      />
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={save.pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.pending}>
          <Save aria-hidden className="size-4" /> {save.pending ? "Salvando…" : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}

export function EditAccessDialog({ user, role, onClose, onSaved }: { user: AccessUser | null; role: AdminRole; onClose: () => void; onSaved: (update: AccessProfileUpdate) => void }) {
  return (
    <Modal open={user !== null} title={`Dados de ${user?.name ?? user?.email ?? ""}`} description="Nome, e-mail de acesso e WhatsApp." onClose={onClose}>
      {user && <EditForm user={user} role={role} onSaved={onSaved} onCancel={onClose} />}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Nova senha
// ---------------------------------------------------------------------------

interface PasswordFormProps {
  user: AccessUser;
  role: AdminRole;
  onSaved: (password: string) => void;
  onCancel: () => void;
}

function PasswordForm({ user, role, onSaved, onCancel }: PasswordFormProps) {
  const [password, setPassword] = useState(() => generatePassword(14));
  const save = useMutation((deps, value: string) => setAccessPassword(deps, role, user.id, { password: value }));
  const copy = useCopy();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await save.run(password);
    if (saved) onSaved(saved);
  };

  return (
    <form noValidate onSubmit={submit} aria-busy={save.pending} className="space-y-4">
      <TextField
        label="Senha provisória"
        name="password"
        autoComplete="off"
        spellCheck={false}
        className="font-mono"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        hint={PASSWORD_RULE_HINT}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setPassword(generatePassword(14))}>
          <RefreshCw aria-hidden className="size-4" /> Gerar outra
        </Button>
        <Button variant="secondary" onClick={() => void copy(password, "Senha copiada.")}>
          <Copy aria-hidden className="size-4" /> Copiar
        </Button>
      </div>
      {save.error && <InlineError message={save.error.message} />}
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="ghost" onClick={onCancel} disabled={save.pending}>
          Cancelar
        </Button>
        <Button type="submit" disabled={save.pending}>
          <KeyRound aria-hidden className="size-4" /> {save.pending ? "Trocando…" : "Trocar e mandar acesso"}
        </Button>
      </div>
    </form>
  );
}

export function PasswordDialog({ user, role, onClose, onSaved }: { user: AccessUser | null; role: AdminRole; onClose: () => void; onSaved: (password: string) => void }) {
  return (
    <Modal
      open={user !== null}
      title={`Nova senha para ${user?.name ?? user?.email ?? ""}`}
      description="A senha antiga para de funcionar na hora. Depois de trocar, a mensagem com o acesso já vem pronta."
      onClose={onClose}
    >
      {user && <PasswordForm user={user} role={role} onSaved={onSaved} onCancel={onClose} />}
    </Modal>
  );
}
