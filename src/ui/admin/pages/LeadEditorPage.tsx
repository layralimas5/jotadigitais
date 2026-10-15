import { ArrowLeft, MessageCircle, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteLead, findLead, saveLead } from "@/application/admin-use-cases";
import { fieldErrorsOf, leadDataSchema } from "@/application/schemas";
import { LEAD_SOURCES, LEAD_SOURCE_LABEL, LEAD_STAGES, LEAD_STAGE_LABEL, type Lead, type LeadSource, type LeadStage } from "@/domain/lead";
import { PLATFORMS, PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { Button, buttonClasses } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, InlineError, LoadingBlock, MobileActionBar, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FollowUpBadge } from "../components/FollowUpBadge";
import { SelectField, TextAreaField } from "../components/FormControls";
import { emptyLeadForm, fromLead, toRawLead, type LeadFormValues } from "../forms/lead-form";
import { useAdminQuery, useMessageTemplates, useMutation } from "../hooks";
import { localIsoDate } from "../lib/dates";
import { personMessage } from "../lib/messages";
import { firstNameOf, whatsappChatUrl } from "../lib/whatsapp";
import { useToast } from "../toast";

const FIELD_ORDER = ["name", "whatsapp", "instagram", "budget", "nextFollowUp", "notes"] as const;

const SOURCE_OPTIONS = LEAD_SOURCES.map((source) => ({ value: source, label: LEAD_SOURCE_LABEL[source] }));
const STAGE_OPTIONS = LEAD_STAGES.map((stage) => ({ value: stage, label: LEAD_STAGE_LABEL[stage] }));
const INTEREST_OPTIONS = [
  { value: "", label: "Ainda não sabe" },
  ...PLATFORMS.map((platform) => ({ value: platform, label: PLATFORM_LABEL[platform] })),
];

const QUICK_FOLLOW_UPS = [
  { label: "Amanhã", days: 1 },
  { label: "Em 3 dias", days: 3 },
  { label: "Em 1 semana", days: 7 },
] as const;

function daysFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localIsoDate(date);
}

function validate(values: LeadFormValues) {
  const result = leadDataSchema.safeParse(toRawLead(values));
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

function BackLink() {
  return (
    <Link to="/admin/crm" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
      <ArrowLeft aria-hidden className="size-4" /> Voltar para o CRM
    </Link>
  );
}

function LeadEditor({ lead }: { lead: Lead | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<LeadFormValues>(() => (lead ? fromLead(lead) : emptyLeadForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const save = useMutation((deps, raw: ReturnType<typeof toRawLead>) => saveLead(deps, lead?.id ?? null, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteLead(deps, id);
    return true;
  });
  const today = localIsoDate();
  const templates = useMessageTemplates();

  const update = (patch: Partial<LeadFormValues>) => {
    const next = { ...values, ...patch };
    setValues(next);
    if (submitted) setErrors(validate(next).errors);
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const formElement = event.currentTarget;
    const result = validate(values);
    setErrors(result.errors);
    if (!result.data) {
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) formElement.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(toRawLead(values));
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`Lead salvo: ${firstNameOf(saved.name)}.`);
    navigate("/admin/crm");
  };

  const onDelete = async () => {
    if (!lead) return;
    const removed = await remove.run(lead.id);
    if (!removed) return;
    toast.show("Lead apagado.");
    navigate("/admin/crm");
  };

  const whatsappDigits = values.whatsapp.replace(/\D/g, "");

  return (
    <>
      <BackLink />
      <div className="mt-4">
        <PageHeader title={lead ? lead.name : "Novo lead"} description="Quem chamou interessado em comprar uma conta." />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid gap-6 lg:grid-cols-[1fr_18rem] lg:items-start">
        <div className="space-y-5">
          <FormSection title="Contato">
            <TextField
              label="Nome"
              name="name"
              autoComplete="off"
              maxLength={80}
              value={values.name}
              onChange={(event) => update({ name: event.target.value })}
              error={errors.name}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="WhatsApp"
                name="whatsapp"
                type="tel"
                inputMode="tel"
                autoComplete="off"
                placeholder="(11) 91234-5678"
                value={values.whatsapp}
                onChange={(event) => update({ whatsapp: event.target.value })}
                error={errors.whatsapp}
              />
              <TextField
                label="Instagram"
                name="instagram"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="@perfil"
                maxLength={31}
                value={values.instagram}
                onChange={(event) => update({ instagram: event.target.value })}
                error={errors.instagram}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Chegou por"
                name="source"
                options={SOURCE_OPTIONS}
                value={values.source}
                onChange={(event) => update({ source: event.target.value as LeadSource })}
              />
              <SelectField
                label="Quer conta de"
                name="interest"
                options={INTEREST_OPTIONS}
                value={values.interest}
                onChange={(event) => update({ interest: event.target.value as Platform | "" })}
              />
            </div>
          </FormSection>

          <FormSection title="Negociação">
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField
                label="Etapa"
                name="stage"
                options={STAGE_OPTIONS}
                value={values.stage}
                onChange={(event) => update({ stage: event.target.value as LeadStage })}
              />
              <TextField
                label="Quanto quer investir (R$)"
                name="budget"
                inputMode="decimal"
                placeholder="400,00"
                value={values.budget}
                onChange={(event) => update({ budget: event.target.value })}
                error={errors.budget}
                hint="Opcional. Soma no valor em negociação."
              />
            </div>
            <div>
              <TextField
                label="Chamar de novo em"
                name="nextFollowUp"
                type="date"
                className="sm:max-w-60"
                value={values.nextFollowUp}
                onChange={(event) => update({ nextFollowUp: event.target.value })}
                error={errors.nextFollowUp}
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {QUICK_FOLLOW_UPS.map((option) => (
                  <button
                    key={option.days}
                    type="button"
                    onClick={() => update({ nextFollowUp: daysFromToday(option.days) })}
                    className="rounded-full border border-line-strong px-3 py-1 text-xs text-fog hover:border-white/30 hover:text-white"
                  >
                    {option.label}
                  </button>
                ))}
                {values.nextFollowUp && (
                  <button
                    type="button"
                    onClick={() => update({ nextFollowUp: "" })}
                    className="rounded-full px-3 py-1 text-xs text-mist hover:text-white"
                  >
                    Sem data
                  </button>
                )}
              </div>
            </div>
            <TextAreaField
              label="Anotações"
              name="notes"
              maxLength={2000}
              placeholder="O que a pessoa procura, objeções, o que foi combinado…"
              value={values.notes}
              onChange={(event) => update({ notes: event.target.value })}
              error={errors.notes}
            />
          </FormSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <div className="space-y-3 rounded-3xl border border-line bg-surface/60 p-5 text-sm">
            <p className="font-medium text-fog">{LEAD_STAGE_LABEL[values.stage]}</p>
            <FollowUpBadge lead={{ stage: values.stage, nextFollowUp: values.nextFollowUp || null }} today={today} />
            {whatsappDigits.length >= 10 && (
              <a
                href={whatsappChatUrl(whatsappDigits, personMessage(templates, "crm_follow_up", values.name))}
                target="_blank"
                rel="noreferrer"
                className={buttonClasses({ variant: "secondary", className: "w-full" })}
              >
                <MessageCircle aria-hidden className="size-4 text-emerald-300" /> Chamar no WhatsApp
              </a>
            )}
          </div>
          {Object.keys(errors).length > 0 && <InlineError message="Revise os campos marcados em vermelho." />}
          {save.error && <InlineError message={save.error.message} />}
          <Button type="submit" size="lg" className="w-full max-md:hidden" disabled={save.pending}>
            {save.pending ? "Salvando…" : lead ? "Salvar alterações" : "Cadastrar lead"}
          </Button>
          {lead && (
            <Button variant="ghost" className="w-full text-[#ff7a7a] hover:text-[#ff9a9a]" onClick={() => setConfirmOpen(true)}>
              <Trash2 aria-hidden className="size-4" /> Apagar lead
            </Button>
          )}
          {remove.error && <InlineError message={remove.error.message} />}
        </aside>

        <MobileActionBar>
          <Button variant="secondary" size="lg" className="shrink-0" onClick={() => navigate("/admin/crm")}>
            Voltar
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={save.pending}>
            {save.pending ? "Salvando…" : lead ? "Salvar" : "Cadastrar lead"}
          </Button>
        </MobileActionBar>
      </form>

      {lead && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar este lead?"
          description="Ele sai do CRM de vez. Se a pessoa só desistiu, mova para “Perdido” e o histórico fica guardado."
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function LeadEditorPage() {
  const { id } = useParams();
  const lead = useAdminQuery((deps) => (id ? findLead(deps, id) : Promise.resolve(null)), id ?? "new");

  if (lead.status === "loading") return <LoadingBlock />;
  if (lead.status === "error") return <ErrorState message={lead.error.message} onRetry={lead.reload} />;
  if (id && !lead.data) {
    return <EmptyState title="Lead não encontrado" description="Ele pode ter sido apagado." action={<BackLink />} />;
  }
  return <LeadEditor key={id ?? "new"} lead={lead.data} />;
}
