import { useState, type FormEvent } from "react";
import { affiliateNewPasswordSchema, affiliateProfileSchema, setAffiliatePassword, updateAffiliateProfile } from "@/application/affiliate-use-cases";
import { fieldErrorsOf, PASSWORD_RULE_HINT } from "@/application/schemas";
import { AFFILIATE_STATUS_LABEL, type AffiliateMe } from "@/domain/affiliate";
import { formatDocument, maskDocumentInput } from "@/domain/brazil";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { PasswordField } from "@/ui/components/form/PasswordField";
import { useAsync } from "@/ui/hooks/useAsync";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { PanelSection } from "../components/AffiliateUi";
import { useAffiliateMe, useAffiliateSession } from "../session";

function Notice({ tone, children }: { tone: "ok" | "error"; children: string }) {
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={
        tone === "error"
          ? "rounded-xl border border-alert/40 bg-alert/10 px-4 py-3 text-sm text-[#ffb4b4]"
          : "rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100"
      }
    >
      {children}
    </p>
  );
}

function ProfileForm({ me, currentDocument }: { me: AffiliateMe; currentDocument: string | null }) {
  const { refresh, portal: affiliatePortal, preview } = useAffiliateSession();
  const [name, setName] = useState(me.name);
  const [whatsapp, setWhatsapp] = useState(me.whatsapp ?? "");
  const [document, setDocument] = useState("");
  const [pixKey, setPixKey] = useState(me.pixKey ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const raw = { name, whatsapp, document: document || null, pixKey };
    const parsed = affiliateProfileSchema.safeParse(raw);
    setErrors(parsed.success ? {} : fieldErrorsOf(parsed.error));
    if (!parsed.success) return;
    setPending(true);
    setNotice(null);
    try {
      await updateAffiliateProfile(affiliatePortal, raw);
      setDocument("");
      setNotice({ tone: "ok", text: "Dados salvos." });
      refresh();
    } catch (reason) {
      console.error(reason);
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : "Não foi possível salvar." });
    } finally {
      setPending(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={pending} className="space-y-4">
      <TextField label="E-mail (login)" name="email" value={me.email} readOnly disabled hint="Para trocar o e-mail, fale com a loja." />
      <TextField label="Nome completo" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} error={errors.name} />
      <TextField label="WhatsApp" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} error={errors.whatsapp} />
      <TextField
        label={currentDocument ? `CPF (atual: ${formatDocument(currentDocument)})` : "CPF"}
        name="document"
        inputMode="numeric"
        autoComplete="off"
        placeholder={currentDocument ? "Preencha só para trocar" : "000.000.000-00"}
        value={document}
        onChange={(event) => setDocument(maskDocumentInput(event.target.value).slice(0, 14))}
        error={errors.document}
      />
      <TextField
        label="Chave Pix"
        name="pixKey"
        autoComplete="off"
        spellCheck={false}
        placeholder="CPF, e-mail, celular ou chave aleatória"
        value={pixKey}
        onChange={(event) => setPixKey(event.target.value)}
        error={errors.pixKey}
        hint="Precisa estar no seu nome: é para onde vão as comissões."
      />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" disabled={pending || preview !== null}>
          {pending ? "Salvando…" : "Salvar dados"}
        </Button>
      </div>
    </form>
  );
}

function PasswordForm() {
  const { portal: affiliatePortal, preview } = useAffiliateSession();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsed = affiliateNewPasswordSchema.safeParse({ password, confirmation });
    setErrors(parsed.success ? {} : fieldErrorsOf(parsed.error));
    if (!parsed.success) return;
    setPending(true);
    setNotice(null);
    try {
      await setAffiliatePassword(affiliatePortal, { password, confirmation });
      setPassword("");
      setConfirmation("");
      setNotice({ tone: "ok", text: "Senha trocada." });
    } catch (reason) {
      console.error(reason);
      setNotice({ tone: "error", text: reason instanceof Error ? reason.message : "Não foi possível trocar a senha." });
    } finally {
      setPending(false);
    }
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={pending} className="space-y-4">
      <PasswordField label="Senha nova" name="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} error={errors.password} hint={PASSWORD_RULE_HINT} />
      <PasswordField label="Repita a senha" name="confirmation" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} error={errors.confirmation} />
      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      <div className="flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending || preview !== null}>
          {pending ? "Salvando…" : "Trocar senha"}
        </Button>
      </div>
    </form>
  );
}

export default function AffiliateProfilePage() {
  useDocumentMeta("Perfil do afiliado");
  const me = useAffiliateMe();
  const { portal: affiliatePortal, preview } = useAffiliateSession();
  const document = useAsync(() => affiliatePortal.myDocument(me.id), `affiliate-document:${me.id}:${me.name}`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">Perfil</h1>
        <p className="mt-1 text-sm text-fog">
          Situação: <strong className="text-white">{AFFILIATE_STATUS_LABEL[me.status]}</strong> · Seu código: <span className="font-mono text-white">{me.code}</span>
        </p>
      </div>
      {preview && <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-mist">Visualização: os campos aparecem como o afiliado vê, mas nada é salvo. CPF e Pix ficam ocultos.</p>}
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <PanelSection title="Seus dados">
          {document.status === "success" || document.status === "error" ? (
            <ProfileForm me={me} currentDocument={document.status === "success" ? document.data : null} />
          ) : (
            <p className="text-sm text-mist">Carregando…</p>
          )}
        </PanelSection>
        <PanelSection title="Senha">
          <PasswordForm />
        </PanelSection>
      </div>
    </div>
  );
}
