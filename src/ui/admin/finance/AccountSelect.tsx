import { listAllAccounts } from "@/application/admin-use-cases";
import type { Account } from "@/domain/account";
import { PLATFORM_LABEL } from "@/domain/platform";
import { QuerySelect } from "./QuerySelect";

const toOption = (account: Account) => ({ value: account.id, label: `${account.handle} · ${PLATFORM_LABEL[account.platform]}` });

/** Liga um lançamento a uma conta do estoque: quanto ela custou (despesa) ou por quanto saiu (receita). */
export function AccountSelect({ value, onChange, hint }: { value: string; onChange: (accountId: string) => void; hint: string }) {
  return (
    <QuerySelect
      label="Conta relacionada"
      name="accountId"
      hint={hint}
      value={value}
      onChange={onChange}
      load={listAllAccounts}
      queryKey="finance-accounts"
      emptyOption={{ value: "", label: "Nenhuma conta" }}
      toOption={toOption}
    />
  );
}
