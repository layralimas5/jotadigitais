import { CONTROLLER_FIELDS, type ControllerField } from "@/domain/legal/legal-document";
import { LEGAL_LIMITS } from "@/domain/legal/legal-editing";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection } from "../../components/AdminUi";
import type { FieldErrors } from "../fields";
import type { ControllerDraft } from "./legal-draft";

const LABEL: Record<ControllerField, string> = {
  brand: "Marca",
  legalName: "Nome ou razão social",
  document: "CNPJ ou CPF",
  address: "Endereço",
  email: "E-mail de contato",
  privacyEmail: "E-mail para privacidade",
  dpoName: "Encarregado de dados (DPO)",
  dpoEmail: "E-mail do encarregado",
  paymentProvider: "Empresa de pagamento",
  invoiceProvider: "Emissor de nota fiscal",
};

const EMAIL_FIELDS: ReadonlySet<ControllerField> = new Set(["email", "privacyEmail", "dpoEmail"]);

interface ControllerFieldsProps {
  value: ControllerDraft;
  errors: FieldErrors;
  onChange: (value: ControllerDraft) => void;
}

/** Quem responde pelos dados: entra no texto pelos campos {{legalName}}, {{document}} e companhia. */
export function ControllerFields({ value, errors, onChange }: ControllerFieldsProps) {
  return (
    <FormSection
      title="Dados da empresa"
      description="Aparecem nos dois documentos. Campo vazio fica destacado no site como “preencher”. Mudar aqui publica versão nova dos dois."
    >
      <div className="grid gap-4 sm:grid-cols-2">
        {CONTROLLER_FIELDS.map((field) => (
          <TextField
            key={field}
            label={LABEL[field]}
            name={`controller.${field}`}
            type={EMAIL_FIELDS.has(field) ? "email" : "text"}
            autoComplete="off"
            maxLength={LEGAL_LIMITS.controllerField}
            value={value[field]}
            error={errors[`controller.${field}`]}
            hint={`{{${field}}}`}
            onChange={(event) => onChange({ ...value, [field]: event.target.value })}
          />
        ))}
      </div>
    </FormSection>
  );
}
