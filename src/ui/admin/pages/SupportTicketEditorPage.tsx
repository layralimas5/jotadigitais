import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fieldErrorsOf, SUPPORT_TEXT_MAX, SUPPORT_TITLE_MAX, supportTicketDataSchema } from "@/application/schemas";
import { openSupportTicket } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import {
  canChangeSupportVisibility,
  canNotifyAdmin,
  SUPPORT_AREA_LABEL,
  SUPPORT_AREAS,
  SUPPORT_KIND_LABEL,
  SUPPORT_KINDS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  type SupportTicketData,
  type SupportUpload,
} from "@/domain/support-ticket";
import { TextField } from "@/ui/components/form/Fields";
import { cn } from "@/ui/lib/cn";
import { FormSection, PageHeader } from "../components/AdminUi";
import { SegmentedField, TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useViewRole } from "../admin-view";
import { useMutation } from "../hooks";
import { AttachmentPicker, pasteFilesInto, uploadsOf, usePickedFiles } from "../support/AttachmentPicker";
import { NotifyAdminCheckbox } from "../support/NotifyAdminCheckbox";
import { KIND_ICON } from "../support/SupportBadges";
import { PRIORITY_TONE } from "../support/priority-tone";
import { useToast } from "../toast";

const LIST_PATH = "/admin/suporte";

// Normal fica no meio das três opções de prioridade, mas é o padrão.
// O que a desenvolvedora abre é tarefa dela: nasce só para ela, e ela pode mostrar ao Jota.
const emptyFor = (role: AdminRole): SupportTicketData => ({
  title: "",
  description: "",
  kind: "problem",
  area: "system",
  priority: "normal",
  internal: canChangeSupportVisibility(role),
});

const FIELD_ORDER = ["title", "description"] as const;

const KIND_OPTIONS = SUPPORT_KINDS.map((value) => {
  const Icon = KIND_ICON[value];
  return { value, label: SUPPORT_KIND_LABEL[value], icon: <Icon aria-hidden className="size-4" /> };
});
const VISIBILITY_OPTIONS = [
  { value: "internal", label: "Só eu", icon: <EyeOff aria-hidden className="size-4" /> },
  { value: "shared", label: "Eu e o Jota", icon: <Eye aria-hidden className="size-4" /> },
] as const;
const AREA_OPTIONS = SUPPORT_AREAS.map((value) => ({ value, label: SUPPORT_AREA_LABEL[value] }));
// Na ficha a ordem é a da escala: baixa, normal, urgente.
const PRIORITY_OPTIONS = [...SUPPORT_PRIORITIES].reverse().map((value) => ({
  value,
  label: SUPPORT_PRIORITY_LABEL[value],
  icon: <span aria-hidden className={cn("dot-glow size-2.5 rounded-full", PRIORITY_TONE[value].dot)} />,
  selectedClassName: PRIORITY_TONE[value].selected,
}));

function validate(values: SupportTicketData) {
  const result = supportTicketDataSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

export default function SupportTicketEditorPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const role = useViewRole() ?? "admin";
  const [values, setValues] = useState<SupportTicketData>(() => emptyFor(role));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const picked = usePickedFiles();
  const [notifyAdmin, setNotifyAdmin] = useState(true);
  const open = useMutation((deps, data: SupportTicketData, uploads: SupportUpload[], notify: boolean) =>
    openSupportTicket(deps, role, data, uploads, { notifyAdmin: notify }),
  );
  const canNotify = canNotifyAdmin(values, role);

  const update = (patch: Partial<SupportTicketData>) => {
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
      return;
    }
    const opened = await open.run(values, uploadsOf(picked.files), canNotify && notifyAdmin);
    if (!opened) return;
    const { saved, failedUploads, notified } = opened;
    if (!notified) toast.show("Chamado aberto, mas o aviso no sininho do Jota falhou.", "error");
    if (failedUploads.length) toast.show(`Chamado aberto, mas não subiu: ${failedUploads.join(", ")}. Envie de novo na conversa.`, "error");
    else toast.show("Chamado aberto.");
    // Volta para a listagem com o chamado novo já aberto no andamento, em vez de cair na conversa.
    navigate(LIST_PATH, { replace: true, state: { openedTicketId: saved.id } });
  };

  return (
    <>
      <Link to={LIST_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader title="Novo chamado" description="Problema, melhoria ou pendência no sistema ou no site. Quanto mais detalhe, mais rápido sai." />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={open.pending} className="mt-6 grid max-w-3xl grid-cols-1 gap-6">
        <FormSection title="O que é">
          <SegmentedField legend="Tipo" name="kind" columns={3} value={values.kind} options={KIND_OPTIONS} onChange={(kind) => update({ kind })} />
          <SegmentedField legend="Onde" name="area" value={values.area} options={AREA_OPTIONS} onChange={(area) => update({ area })} />
          <SegmentedField
            legend="Prioridade"
            name="priority"
            columns={3}
            value={values.priority}
            options={PRIORITY_OPTIONS}
            onChange={(priority) => update({ priority })}
          />
          {canChangeSupportVisibility(role) && (
            <div>
              <SegmentedField
                legend="Quem vê"
                name="visibility"
                value={values.internal ? "internal" : "shared"}
                options={VISIBILITY_OPTIONS}
                onChange={(value) => update({ internal: value === "internal" })}
              />
              <p className="mt-2 text-xs text-mist">“Só eu”: fica só no seu painel, o Jota não vê. Dá para mudar depois no chamado.</p>
              {canNotify && (
                <div className="mt-3">
                  <NotifyAdminCheckbox checked={notifyAdmin} onChange={setNotifyAdmin} disabled={open.pending} />
                </div>
              )}
            </div>
          )}
        </FormSection>

        <FormSection title="Detalhes" description="Diga onde está, o que aconteceu e o que você esperava. Um print ou vídeo ajuda muito.">
          <TextField
            label="Título"
            name="title"
            autoComplete="off"
            maxLength={SUPPORT_TITLE_MAX}
            placeholder="Ex.: Botão de pagar não abre no celular"
            value={values.title}
            onChange={(event) => update({ title: event.target.value })}
            error={errors.title}
          />
          <TextAreaField
            label="Descrição"
            name="description"
            rows={6}
            maxLength={SUPPORT_TEXT_MAX}
            placeholder="Ex.: Na página da conta, quando toco em Comprar no iPhone, nada acontece."
            value={values.description}
            onChange={(event) => update({ description: event.target.value })}
            onPaste={pasteFilesInto(picked.addFiles)}
            error={errors.description}
          />
          <AttachmentPicker files={picked.files} problem={picked.problem} onFiles={picked.addFiles} onRemove={picked.remove} disabled={open.pending} />
        </FormSection>

        <FormFooter
          submitLabel="Abrir chamado"
          mobileSubmitLabel="Abrir"
          pendingLabel={picked.files.length ? "Enviando arquivos…" : "Enviando…"}
          submitIcon={<Send aria-hidden className="size-4" />}
          pending={open.pending}
          onCancel={() => navigate(LIST_PATH)}
          errors={[open.error?.message]}
        />
      </form>
    </>
  );
}
