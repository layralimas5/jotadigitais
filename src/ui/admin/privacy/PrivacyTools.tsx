import { useState, type FormEvent } from "react";
import { anonymizeDataSubject, applyRetentionPolicy } from "@/application/privacy-use-cases";
import type { AnonymizationResult, RetentionResult } from "@/domain/privacy";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { FormSection, InlineError } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useMutation } from "../hooks";
import { useToast } from "../toast";

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function anonymizationSummary(result: AnonymizationResult): string {
  return [
    plural(result.anonymizedOrders, "pedido anonimizado", "pedidos anonimizados"),
    plural(result.keptOrders, "pedido mantido pela nota fiscal (sem o Instagram)", "pedidos mantidos pela nota fiscal (sem o Instagram)"),
    plural(result.deletedCustomers, "cadastro apagado", "cadastros apagados"),
  ].join(", ");
}

function retentionSummary(result: RetentionResult): string {
  return [
    plural(result.anonymizedOrders, "pedido anonimizado", "pedidos anonimizados"),
    plural(result.deletedLeads, "lead apagado", "leads apagados"),
    plural(result.deletedNotifications, "aviso apagado", "avisos apagados"),
    plural(result.deletedRequests, "solicitação antiga apagada", "solicitações antigas apagadas"),
    plural(result.deletedAttempts, "tentativa apagada", "tentativas apagadas"),
  ].join(", ");
}

type PendingAction = "anonymize" | "retention";

interface PrivacyToolsProps {
  email: string;
  onEmailChange: (email: string) => void;
  onDone: () => void;
}

export function PrivacyTools({ email, onEmailChange, onDone }: PrivacyToolsProps) {
  const toast = useToast();
  const [confirm, setConfirm] = useState<PendingAction | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const anonymize = useMutation(anonymizeDataSubject);
  const retention = useMutation(applyRetentionPolicy);
  const error = anonymize.error ?? retention.error;

  const ask = (action: PendingAction) => {
    setSummary(null);
    anonymize.reset();
    retention.reset();
    setConfirm(action);
  };

  const askAnonymize = (event: FormEvent) => {
    event.preventDefault();
    ask("anonymize");
  };

  const runAnonymize = async () => {
    const result = await anonymize.run(email);
    setConfirm(null);
    if (!result) return;
    setSummary(anonymizationSummary(result));
    toast.show("Titular anonimizado.");
    onDone();
  };

  const runRetention = async () => {
    const result = await retention.run();
    setConfirm(null);
    if (!result) return;
    setSummary(retentionSummary(result));
    toast.show("Prazos de retenção aplicados.");
    onDone();
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <FormSection
        title="Anonimizar um titular"
        description="Para pedidos de eliminação. Pedido cancelado ou não pago perde todos os dados pessoais; pedido pago ou entregue fica 5 anos pela nota fiscal, só sem o Instagram; o cadastro manual com o e-mail é apagado."
      >
        <form id="anonimizar" noValidate onSubmit={askAnonymize} className="space-y-4">
          <TextField
            label="E-mail do titular"
            type="email"
            inputMode="email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
          />
          <Button type="submit" variant="secondary" disabled={!email.trim() || anonymize.pending}>
            Anonimizar
          </Button>
        </form>
      </FormSection>

      <FormSection
        title="Aplicar prazos de retenção"
        description="Segue a seção 8 da Política: anonimiza pedidos cancelados com mais de 6 meses e vendas com mais de 5 anos, apaga leads sem compra parados há 12 meses, avisos com mais de 90 dias e tentativas de acesso com mais de 30. Rode uma vez por mês."
      >
        <Button variant="secondary" onClick={() => ask("retention")} disabled={retention.pending}>
          Aplicar agora
        </Button>
      </FormSection>

      <div className="lg:col-span-2" aria-live="polite">
        {error && <InlineError message={error.message} />}
        {summary && <p className="rounded-2xl border border-line bg-surface px-4 py-3 text-sm text-fog">{summary}.</p>}
      </div>

      {/* Um diálogo só: o ConfirmDialog usa id fixo no título. */}
      <ConfirmDialog
        open={confirm !== null}
        title={confirm === "retention" ? "Aplicar os prazos de retenção?" : "Anonimizar este titular?"}
        description={
          confirm === "retention"
            ? "Os dados vencidos são anonimizados ou apagados de vez. Não dá para desfazer. Se quiser uma cópia antes, baixe o backup em Configurações."
            : `Os dados de ${email.trim()} saem dos pedidos que não precisam mais deles e o cadastro manual é apagado. Não dá para desfazer.`
        }
        confirmLabel={confirm === "retention" ? "Aplicar" : "Anonimizar"}
        pending={anonymize.pending || retention.pending}
        onConfirm={confirm === "retention" ? runRetention : runAnonymize}
        onClose={() => setConfirm(null)}
      />
    </div>
  );
}
