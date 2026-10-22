import { LockKeyhole } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";

interface AccessFormProps {
  pending: boolean;
  error: string | null;
  fieldErrors: Record<string, string>;
  onSubmit: (access: { email: string; orderCode: string }) => void;
}

/** O titular prova que o pedido é dele com o e-mail usado na compra e o código JD-XXXXXX. */
export function AccessForm({ pending, error, fieldErrors, onSubmit }: AccessFormProps) {
  const [email, setEmail] = useState("");
  const [orderCode, setOrderCode] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ email, orderCode });
  };

  return (
    <form noValidate onSubmit={submit} aria-busy={pending} className="rounded-3xl border border-line bg-surface p-5 sm:p-7">
      <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-white">
        <LockKeyhole aria-hidden className="size-5 text-electric" /> Confirme que os dados são seus
      </h2>
      <p className="mt-1.5 text-sm text-mist">Use o e-mail da compra e o código do pedido, que está no e-mail de confirmação.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <TextField
          label="E-mail da compra"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
          required
        />
        <TextField
          label="Código do pedido"
          name="orderCode"
          placeholder="JD-XXXXXX"
          autoCapitalize="characters"
          autoComplete="off"
          value={orderCode}
          onChange={(event) => setOrderCode(event.target.value)}
          error={fieldErrors.orderCode}
          required
        />
      </div>
      {error && Object.keys(fieldErrors).length === 0 && (
        <p role="alert" className="mt-4 rounded-2xl border border-alert/30 bg-alert/[0.07] px-4 py-3 text-sm text-white">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" disabled={pending} className="mt-6 w-full sm:w-auto">
        {pending ? "Conferindo…" : "Ver meus dados"}
      </Button>
    </form>
  );
}
