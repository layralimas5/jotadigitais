import { Plus } from "lucide-react";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { createCountry, listAccountCountries } from "@/application/admin-use-cases";
import { fallbackCountryName, type Country } from "@/domain/country";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { SelectField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";

interface CountryFieldProps {
  value: string;
  onChange: (country: Country) => void;
  error?: string;
}

/** Formulário curto para criar o país que não está na lista; o novo já fica escolhido na conta. */
function NewCountryForm({ onCreated, onCancel }: { onCreated: (country: Country) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const create = useMutation(createCountry);

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    const country = await create.run(name);
    if (country) onCreated(country);
  };
  // Fica dentro do formulário da conta: Enter cria o país em vez de salvar a conta.
  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void submit(event);
    if (event.key === "Escape") onCancel();
  };

  return (
    <div className="mt-3 rounded-2xl border border-line bg-ink/60 p-3">
      <TextField
        label="Nome do país novo"
        name="newCountry"
        autoFocus
        placeholder="Ex.: Nova Zelândia"
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={onKeyDown}
        error={create.error?.message}
        hint="Aparece na ficha, na vitrine e no filtro de países do site."
      />
      <div className="mt-3 flex gap-2">
        <Button size="md" disabled={create.pending || name.trim().length < 2} onClick={() => void submit()}>
          {create.pending ? "Criando…" : "Criar país"}
        </Button>
        <Button size="md" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

/** País da conta: escolhe da lista do banco ou cria um novo sem sair da ficha. */
export function CountryField({ value, onChange, error }: CountryFieldProps) {
  const countries = useAdminQuery(listAccountCountries, "account-countries");
  const [creating, setCreating] = useState(false);
  const list = countries.status === "success" ? countries.data : [];
  // Enquanto a lista carrega (ou se o país sumiu dela), o país atual continua na caixa.
  const options = list.some((country) => country.code === value)
    ? list
    : [{ code: value, name: fallbackCountryName(value) }, ...list];

  const choose = (code: string) => {
    const country = options.find((item) => item.code === code);
    if (country) onChange(country);
  };

  return (
    <div>
      <SelectField
        label="País da conta"
        name="country"
        value={value}
        options={options.map((country) => ({ value: country.code, label: country.name }))}
        onChange={(event) => choose(event.target.value)}
        error={error ?? (countries.status === "error" ? "Não foi possível carregar os países." : undefined)}
      />
      {creating ? (
        <NewCountryForm
          onCancel={() => setCreating(false)}
          onCreated={(country) => {
            setCreating(false);
            onChange(country);
            countries.reload();
          }}
        />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="mt-2 inline-flex items-center gap-1.5 rounded-md text-xs font-medium text-electric-soft hover:underline focus-visible:outline-2 focus-visible:outline-electric"
        >
          <Plus aria-hidden className="size-3.5" /> Criar outro país
        </button>
      )}
    </div>
  );
}
