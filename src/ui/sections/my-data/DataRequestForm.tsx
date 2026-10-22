import { CircleCheck } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { ValidationError } from "@/application/schemas";
import { DATA_REQUEST_KINDS, DATA_REQUEST_KIND_VIEW, type DataRequestKind, type OpenedDataRequest } from "@/domain/privacy";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";

interface DataRequestFormProps {
  onSubmit: (request: { kind: string; details: string }) => Promise<OpenedDataRequest>;
}

type SubmitState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; opened: OpenedDataRequest }
  | { status: "error"; message: string; fieldErrors: Record<string, string> };

const formatDay = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

/** Os direitos do art. 18 viram uma solicitação com protocolo e prazo de 15 dias. */
export function DataRequestForm({ onSubmit }: DataRequestFormProps) {
  const [kind, setKind] = useState<DataRequestKind | "">("");
  const [details, setDetails] = useState("");
  const [state, setState] = useState<SubmitState>({ status: "idle" });
  const detailsId = useId();
  const fieldErrors = state.status === "error" ? state.fieldErrors : {};

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setState({ status: "sending" });
    try {
      const opened = await onSubmit({ kind, details });
      setState({ status: "sent", opened });
      setKind("");
      setDetails("");
    } catch (error) {
      console.error(error);
      setState({
        status: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar. Tente de novo.",
        fieldErrors: error instanceof ValidationError ? error.fieldErrors : {},
      });
    }
  };

  return (
    <form noValidate onSubmit={submit} aria-busy={state.status === "sending"} className="space-y-5">
      <fieldset>
        <legend className="text-sm font-medium text-fog">O que você quer pedir?</legend>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {DATA_REQUEST_KINDS.map((option) => (
            <label
              key={option}
              className={cn(
                "flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-electric",
                kind === option ? "border-electric bg-electric/[0.07]" : "border-line-strong bg-ink hover:border-white/25",
              )}
            >
              <input
                type="radio"
                name="kind"
                value={option}
                checked={kind === option}
                onChange={() => setKind(option)}
                className="mt-0.5 size-4 shrink-0 accent-electric"
              />
              <span>
                <span className="block text-sm font-semibold text-white">{DATA_REQUEST_KIND_VIEW[option].label}</span>
                <span className="mt-0.5 block text-xs leading-relaxed text-mist">{DATA_REQUEST_KIND_VIEW[option].description}</span>
              </span>
            </label>
          ))}
        </div>
        {fieldErrors.kind && <p className="mt-2 text-xs font-medium text-[#ff7a7a]">{fieldErrors.kind}</p>}
      </fieldset>

      <div>
        <label htmlFor={detailsId} className="text-sm font-medium text-fog">
          Detalhes {kind === "correction" ? "" : "(opcional)"}
        </label>
        <textarea
          id={detailsId}
          name="details"
          rows={4}
          maxLength={2000}
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          aria-invalid={fieldErrors.details ? true : undefined}
          aria-describedby={fieldErrors.details ? `${detailsId}-error` : undefined}
          className={cn(
            "mt-2 w-full rounded-xl border bg-ink px-4 py-3 text-white placeholder:text-mist/70 focus:outline-none",
            fieldErrors.details ? "border-alert/70 focus:border-alert" : "border-line-strong focus:border-electric",
          )}
        />
        {fieldErrors.details && (
          <p id={`${detailsId}-error`} className="mt-1.5 text-xs font-medium text-[#ff7a7a]">
            {fieldErrors.details}
          </p>
        )}
      </div>

      {state.status === "error" && Object.keys(state.fieldErrors).length === 0 && (
        <p role="alert" className="rounded-2xl border border-alert/30 bg-alert/[0.07] px-4 py-3 text-sm text-white">
          {state.message}
        </p>
      )}
      {state.status === "sent" && (
        <p role="status" className="flex gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-3 text-sm text-white">
          <CircleCheck aria-hidden className="mt-0.5 size-5 shrink-0 text-emerald-300" />
          <span>
            Solicitação aberta com o protocolo <strong className="font-mono">{state.opened.protocol}</strong>. Respondemos até{" "}
            {formatDay(state.opened.dueAt)} pelo e-mail da compra.
          </span>
        </p>
      )}

      <Button type="submit" size="lg" disabled={state.status === "sending"} className="w-full sm:w-auto">
        {state.status === "sending" ? "Enviando…" : "Enviar solicitação"}
      </Button>
    </form>
  );
}
