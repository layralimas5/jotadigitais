import { AtSign, ExternalLink, MessageCircle, ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { getStoreSettings, saveStoreSettings } from "@/application/admin-use-cases";
import { fieldErrorsOf, storeSettingsSchema } from "@/application/schemas";
import { instagramUrlOf, whatsappUrlOf, type StoreSettings } from "@/domain/store-settings";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { ErrorState } from "@/ui/components/StateViews";
import { FormSection, InlineError, LoadingBlock, PageHeader } from "../components/AdminUi";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

interface SettingsForm {
  whatsappNumber: string;
  instagramHandle: string;
  guaranteeDays: string;
}

const FIELD_ORDER = ["whatsappNumber", "instagramHandle", "guaranteeDays"] as const;

const toForm = (settings: StoreSettings): SettingsForm => ({
  whatsappNumber: settings.whatsappNumber ?? "",
  instagramHandle: settings.instagramHandle,
  guaranteeDays: String(settings.guaranteeDays),
});

function validate(form: SettingsForm) {
  const result = storeSettingsSchema.safeParse({ ...form, guaranteeDays: Number(form.guaranteeDays || Number.NaN) });
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

function PreviewLink({ href, icon, label }: { href: string | null; icon: ReactNode; label: string }) {
  if (!href) {
    return (
      <li className="flex items-center gap-3 text-sm text-mist">
        {icon} {label}: <span className="italic">escondido</span>
      </li>
    );
  }
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-3 text-sm text-fog underline-offset-4 hover:text-white hover:underline"
      >
        {icon} {label} <ExternalLink aria-hidden className="size-3.5 text-mist" />
      </a>
    </li>
  );
}

function SettingsEditor({ settings }: { settings: StoreSettings }) {
  const toast = useToast();
  const [form, setForm] = useState<SettingsForm>(() => toForm(settings));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const save = useMutation(saveStoreSettings);

  const update = (patch: Partial<SettingsForm>) => {
    const next = { ...form, ...patch };
    setForm(next);
    if (submitted) setErrors(validate(next).errors);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const formElement = event.currentTarget;
    const result = validate(form);
    setErrors(result.errors);
    if (!result.data) {
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) formElement.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(result.data);
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    setForm(toForm(saved));
    toast.show("Configurações salvas. O site já usa os novos dados.");
  };

  const preview = validate(form).data;

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
      <div className="space-y-5">
        <FormSection title="Contato" description="Aparece no rodapé, no botão flutuante, na página de cada conta e na confirmação do pedido.">
          <TextField
            label="WhatsApp do suporte"
            name="whatsappNumber"
            type="tel"
            inputMode="tel"
            autoComplete="off"
            placeholder="55 11 91234-5678"
            value={form.whatsappNumber}
            onChange={(event) => update({ whatsappNumber: event.target.value })}
            error={errors.whatsappNumber}
            hint="Com 55 e DDD. Deixe vazio para esconder os botões de WhatsApp do site."
          />
          <TextField
            label="Instagram"
            name="instagramHandle"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="@jotadigitais"
            maxLength={31}
            value={form.instagramHandle}
            onChange={(event) => update({ instagramHandle: event.target.value })}
            error={errors.instagramHandle}
          />
        </FormSection>

        <FormSection title="Garantia" description="O prazo aparece na home, na página de cada conta e nos termos de compra.">
          <TextField
            label="Dias de garantia"
            name="guaranteeDays"
            type="number"
            inputMode="numeric"
            min={1}
            max={90}
            className="sm:max-w-48"
            value={form.guaranteeDays}
            onChange={(event) => update({ guaranteeDays: event.target.value })}
            error={errors.guaranteeDays}
          />
        </FormSection>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <div className="rounded-3xl border border-line bg-surface/60 p-5">
          <p className="text-sm font-medium text-fog">Como fica no site</p>
          {preview ? (
            <ul className="mt-4 space-y-3">
              <PreviewLink href={whatsappUrlOf(preview)} icon={<MessageCircle aria-hidden className="size-4 text-[#25d366]" />} label="WhatsApp" />
              <PreviewLink href={instagramUrlOf(preview)} icon={<AtSign aria-hidden className="size-4 text-pink" />} label={preview.instagramHandle} />
              <li className="flex items-center gap-3 text-sm text-fog">
                <ShieldCheck aria-hidden className="size-4 text-electric" /> {preview.guaranteeDays} dias de garantia
              </li>
            </ul>
          ) : (
            <p className="mt-3 text-sm text-mist">Corrija os campos para ver a prévia.</p>
          )}
        </div>
        {Object.keys(errors).length > 0 && <InlineError message="Revise os campos marcados em vermelho." />}
        {save.error && <InlineError message={save.error.message} />}
        <Button type="submit" size="lg" className="w-full" disabled={save.pending}>
          {save.pending ? "Salvando…" : "Salvar configurações"}
        </Button>
      </aside>
    </form>
  );
}

export default function SettingsPage() {
  const settings = useAdminQuery(getStoreSettings, "store-settings");

  return (
    <>
      <PageHeader title="Configurações" description="Contato e garantia da loja. O que você salvar aqui muda o site inteiro." />
      {settings.status === "loading" && <LoadingBlock />}
      {settings.status === "error" && <ErrorState message={settings.error.message} onRetry={settings.reload} />}
      {settings.status === "success" && <SettingsEditor settings={settings.data} />}
    </>
  );
}
