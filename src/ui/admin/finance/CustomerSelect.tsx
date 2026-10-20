import { listCustomerRecords } from "@/application/admin-use-cases";
import type { CustomerRecord } from "@/domain/customer";
import { QuerySelect } from "./QuerySelect";

const toOption = (record: CustomerRecord) => ({
  value: record.id,
  label: record.email ? `${record.name} · ${record.email}` : record.name,
});

/** Cliente cadastrado à mão que pagou: a venda entra no histórico e no total gasto dele. */
export function CustomerSelect({ value, onChange }: { value: string; onChange: (customerId: string) => void }) {
  return (
    <QuerySelect
      label="Cliente"
      name="customerId"
      hint="Só aparecem os clientes cadastrados à mão. Quem compra pelo site entra sozinho."
      value={value}
      onChange={onChange}
      load={listCustomerRecords}
      queryKey="finance-customer-records"
      emptyOption={{ value: "", label: "Sem cliente ligado" }}
      toOption={toOption}
    />
  );
}
