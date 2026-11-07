import { setSupportLabel } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import type { SupportLabel } from "@/domain/support-ticket";
import { FilterSelect } from "../components/FilterSelect";
import { useMutation } from "../hooks";
import { useToast } from "../toast";
import { LABEL_TONE } from "./label-tone";

const NONE = "none";

interface LabelPickerProps {
  ticketId: string;
  ticketTitle: string;
  labelId: string | null;
  labels: readonly SupportLabel[];
  role: AdminRole;
  onChanged: () => void;
  className?: string;
}

/** Escolha da etiqueta do chamado, direto na lista ou no chamado. Só aparece para a desenvolvedora. */
export function LabelPicker({ ticketId, ticketTitle, labelId, labels, role, onChanged, className }: LabelPickerProps) {
  const toast = useToast();
  const change = useMutation((deps, next: string | null) => setSupportLabel(deps, role, ticketId, next).then(() => next));
  const current = labelId && labels.some((label) => label.id === labelId) ? labelId : NONE;

  const onChange = async (value: string) => {
    if (value === current) return;
    const next = value === NONE ? null : value;
    const done = await change.run(next);
    if (done === undefined) {
      toast.show("Não foi possível trocar a etiqueta. Tente de novo.", "error");
      return;
    }
    onChanged();
  };

  return (
    <FilterSelect
      label={`Etiqueta de ${ticketTitle}`}
      value={current}
      onChange={(value) => void onChange(value)}
      className={className}
      options={[
        { value: NONE, label: "Sem etiqueta", dotClassName: "border border-white/30 bg-transparent" },
        ...labels.map((label) => ({ value: label.id, label: label.name, dotClassName: LABEL_TONE[label.color].dot })),
      ]}
    />
  );
}
