import { changeSupportStatus } from "@/application/support-use-cases";
import type { AdminRole } from "@/domain/admin-user";
import { statusesFor, SUPPORT_STATUS_LABEL, type SupportStatus } from "@/domain/support-ticket";
import { FilterSelect } from "../components/FilterSelect";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

export const STATUS_DOT: Record<SupportStatus, string> = {
  open: "bg-pink",
  in_progress: "bg-electric",
  waiting: "bg-amber-300",
  done: "bg-emerald-400",
};

interface StatusPickerProps {
  ticketId: string;
  ticketTitle: string;
  status: SupportStatus;
  internal: boolean;
  role: AdminRole;
  onChanged: () => void;
}

/** Troca da situação direto na lista (só a desenvolvedora). Finalizado tira o chamado de "Em aberto" na hora. */
export function StatusPicker({ ticketId, ticketTitle, status, internal, role, onChanged }: StatusPickerProps) {
  const toast = useToast();
  const change = useMutation((deps, next: SupportStatus) => changeSupportStatus(deps, role, ticketId, next).then(() => next));

  const onChange = async (next: SupportStatus) => {
    if (next === status) return;
    const done = await change.run(next);
    if (!done) {
      toast.show("Não foi possível mudar a situação. Tente de novo.", "error");
      return;
    }
    toast.show(`“${ticketTitle}”: ${SUPPORT_STATUS_LABEL[done].toLowerCase()}.`);
    onChanged();
  };

  return (
    <FilterSelect
      label={`Situação de ${ticketTitle}`}
      value={status}
      onChange={(next) => void onChange(next)}
      options={statusesFor({ internal }).map((value) => ({ value, label: SUPPORT_STATUS_LABEL[value], dotClassName: STATUS_DOT[value] }))}
    />
  );
}
