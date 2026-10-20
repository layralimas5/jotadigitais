import type { AdminDeps } from "@/application/admin-use-cases";
import { SelectField } from "../components/FormControls";
import { useAdminQuery } from "../hooks";

export interface Option {
  value: string;
  label: string;
}

interface QuerySelectProps<T> {
  label: string;
  name: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  load: (deps: AdminDeps) => Promise<T[]>;
  queryKey: string;
  emptyOption: Option;
  toOption: (item: T) => Option;
}

/** Lista de escolha que carrega as opções do painel (contas, clientes), com estado de carregando e erro. */
export function QuerySelect<T>({ label, name, hint, value, onChange, load, queryKey, emptyOption, toOption }: QuerySelectProps<T>) {
  const items = useAdminQuery(load, queryKey);
  if (items.status !== "success") {
    const failed = items.status === "error";
    return (
      <SelectField
        label={label}
        name={name}
        disabled
        value=""
        options={[{ value: "", label: failed ? "Não foi possível carregar" : "Carregando…" }]}
        hint={failed ? items.error.message : hint}
      />
    );
  }
  return (
    <SelectField
      label={label}
      name={name}
      hint={hint}
      options={[emptyOption, ...items.data.map(toOption)]}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}
