import { ArrowLeft, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { fieldErrorsOf, SUPPORT_TEXT_MAX, SUPPORT_TITLE_MAX, supportTicketDataSchema } from "@/application/schemas";
import { openSupportTicket } from "@/application/support-use-cases";
import {
  SUPPORT_AREA_LABEL,
  SUPPORT_AREAS,
  SUPPORT_PRIORITIES,
  SUPPORT_PRIORITY_LABEL,
  type SupportTicketData,
} from "@/domain/support-ticket";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, PageHeader } from "../components/AdminUi";
import { SegmentedField, TextAreaField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

const LIST_PATH = "/admin/suporte";

const EMPTY: SupportTicketData = { title: "", description: "", area: "system", priority: "normal" };

const FIELD_ORDER = ["title", "description"] as const;

const AREA_OPTIONS = SUPPORT_AREAS.map((value) => ({ value, label: SUPPORT_AREA_LABEL[value] }));
const PRIORITY_OPTIONS = SUPPORT_PRIORITIES.map((value) => ({ value, label: SUPPORT_PRIORITY_LABEL[value] }));

function validate(values: SupportTicketData) {
  const result = supportTicketDataSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: fieldErrorsOf(result.error) };
}

export default function SupportTicketEditorPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const [values, setValues] = useState<SupportTicketData>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const open = useMutation(openSupportTicket);

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
    const ticket = await open.run(values);
    if (!ticket) return;
    toast.show("Chamado aberto.");
    navigate(`${LIST_PATH}/${ticket.id}`, { replace: true });
  };

  return (
    <>
      <Link to={LIST_PATH} className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar
      </Link>
      <div className="mt-4">
        <PageHeader title="Novo chamado" description="Quanto mais detalhe, mais rápido sai o ajuste." />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={open.pending} className="mt-6 grid max-w-3xl gap-6">
        <FormSection title="O que precisa" description="Diga onde está, o que aconteceu e o que você esperava que acontecesse.">
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
            error={errors.description}
          />
        </FormSection>

        <FormSection title="Onde e com que pressa">
          <SegmentedField legend="Onde" name="area" value={values.area} options={AREA_OPTIONS} onChange={(area) => update({ area })} />
          <SegmentedField
            legend="Prioridade"
            name="priority"
            columns={3}
            value={values.priority}
            options={PRIORITY_OPTIONS}
            onChange={(priority) => update({ priority })}
          />
        </FormSection>

        <FormFooter
          submitLabel="Abrir chamado"
          mobileSubmitLabel="Abrir"
          pendingLabel="Enviando…"
          submitIcon={<Send aria-hidden className="size-4" />}
          pending={open.pending}
          onCancel={() => navigate(LIST_PATH)}
          errors={[open.error?.message]}
        />
      </form>
    </>
  );
}
