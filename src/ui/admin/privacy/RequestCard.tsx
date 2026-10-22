import { useState } from "react";
import { answerDataRequest } from "@/application/privacy-use-cases";
import { DATA_REQUEST_KIND_VIEW, DATA_REQUEST_STATUS_LABEL, isOverdue, type DataRequest } from "@/domain/privacy";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { TextAreaField } from "../components/FormControls";
import { useMutation } from "../hooks";
import { formatDate } from "../lib/dates";
import { useToast } from "../toast";

const STATUS_CLASS: Record<DataRequest["status"], string> = {
  open: "border-amber-300/30 bg-amber-300/10 text-amber-200",
  done: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  rejected: "border-white/15 bg-white/[0.05] text-mist",
};

/** Pedidos em que a ferramenta de anonimização resolve a maior parte do trabalho. */
const ANONYMIZING_KINDS: readonly DataRequest["kind"][] = ["anonymization", "consent_deletion", "objection"];

interface RequestCardProps {
  request: DataRequest;
  onChanged: () => void;
  onAnonymize: (email: string) => void;
}

export function RequestCard({ request, onChanged, onAnonymize }: RequestCardProps) {
  const toast = useToast();
  const [response, setResponse] = useState("");
  // `useMutation` devolve `undefined` quando falha: a ação devolve `true` para o sucesso ser reconhecível.
  const save = useMutation(async (deps, id: string, answer: { status: "done" | "rejected"; response: string }) => {
    await answerDataRequest(deps, id, answer);
    return true;
  });
  const overdue = isOverdue(request);

  const answer = async (status: "done" | "rejected") => {
    const saved = await save.run(request.id, { status, response });
    if (saved === undefined) return;
    toast.show(status === "done" ? "Solicitação respondida." : "Solicitação recusada.");
    onChanged();
  };

  return (
    <article className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-6">
      <header className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-sm font-semibold text-white">{request.protocol}</span>
        <span className={cn("rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold", STATUS_CLASS[request.status])}>
          {DATA_REQUEST_STATUS_LABEL[request.status]}
        </span>
        {overdue && (
          <span className="rounded-full border border-alert/40 bg-alert/10 px-2 py-0.5 text-[0.68rem] font-semibold text-white">Prazo vencido</span>
        )}
      </header>
      <h2 className="mt-3 font-display text-base font-semibold text-white">{DATA_REQUEST_KIND_VIEW[request.kind].label}</h2>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div className="min-w-0">
          <dt className="text-xs text-mist">Titular</dt>
          <dd className="truncate">
            <a
              href={`mailto:${request.email}?subject=${encodeURIComponent(`Sua solicitação ${request.protocol}`)}`}
              className="text-electric-soft hover:underline"
            >
              {request.email}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs text-mist">Pedido usado para entrar</dt>
          <dd className="font-mono text-white">{request.orderCode ?? "Sem pedido"}</dd>
        </div>
        <div>
          <dt className="text-xs text-mist">Aberta em</dt>
          <dd className="text-white">{formatDate(request.createdAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-mist">{request.status === "open" ? "Responder até" : "Respondida em"}</dt>
          <dd className={cn("text-white", overdue && "font-semibold text-[#ff7a7a]")}>{formatDate(request.resolvedAt ?? request.dueAt)}</dd>
        </div>
      </dl>
      {request.details && (
        <p className="mt-4 rounded-2xl border border-line bg-ink p-4 text-sm whitespace-pre-line text-fog">{request.details}</p>
      )}

      {request.status === "open" ? (
        <div className="mt-5 space-y-3">
          <TextAreaField
            label="Resposta ao titular"
            hint="Fica registrada e aparece para a pessoa em Meus dados. Mande também por e-mail."
            rows={3}
            maxLength={2000}
            value={response}
            onChange={(event) => setResponse(event.target.value)}
            error={save.error?.message}
          />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button onClick={() => answer("done")} disabled={save.pending}>
              Marcar como respondida
            </Button>
            <Button variant="secondary" onClick={() => answer("rejected")} disabled={save.pending}>
              Recusar com motivo
            </Button>
            {ANONYMIZING_KINDS.includes(request.kind) && (
              <Button variant="ghost" onClick={() => onAnonymize(request.email)}>
                Anonimizar este titular
              </Button>
            )}
          </div>
        </div>
      ) : (
        request.response && (
          <p className="mt-4 text-sm text-mist">
            <span className="font-semibold text-fog">Resposta:</span> {request.response}
          </p>
        )
      )}
    </article>
  );
}
