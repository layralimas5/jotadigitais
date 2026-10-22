import { ShieldCheck, ShieldOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { confirmMfaEnrollment, disableMfa, getMfaFactorId, startMfaEnrollment } from "@/application/admin-use-cases";
import type { MfaEnrollment } from "@/application/ports";
import { Button } from "@/ui/components/Button";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { FormSection, InlineError } from "../components/AdminUi";
import { MfaCodeField, mfaCodeErrorOf } from "../components/MfaChallengeForm";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const DESCRIPTION =
  "Além da senha, o login pede um código do app autenticador do seu celular. Quem descobrir a senha não entra sem ele.";

function EnrollmentForm({ enrollment, onDone, onCancel }: { enrollment: MfaEnrollment; onDone: () => void; onCancel: () => void }) {
  const [code, setCode] = useState("");
  const confirm = useMutation(async (deps, input: { code: string }) => {
    await confirmMfaEnrollment(deps, enrollment.factorId, input);
    return true;
  });
  const codeError = mfaCodeErrorOf(confirm.error);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await confirm.run({ code })) onDone();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={confirm.pending} className="space-y-4">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fog">
        <li>Instale o Google Authenticator (ou outro app autenticador) no celular.</li>
        <li>No app, toque em adicionar e leia o QR code abaixo.</li>
        <li>Digite o código de 6 números que o app mostrar.</li>
      </ol>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        {enrollment.qrCode && (
          <img src={enrollment.qrCode} alt="QR code para cadastrar o painel no app autenticador" className="size-44 rounded-2xl bg-white p-2" />
        )}
        <p className="text-sm text-mist">
          Sem câmera? Digite esta chave no app:
          <code className="mt-1 block break-all rounded-xl bg-white/[0.06] px-3 py-2 font-mono text-sm text-white">{enrollment.secret}</code>
        </p>
      </div>
      <div className="sm:max-w-[calc(50%-0.5rem)]">
        <MfaCodeField value={code} onChange={setCode} error={codeError} autoFocus />
      </div>
      {confirm.error && !codeError && <InlineError message={confirm.error.message} />}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button type="submit" disabled={confirm.pending}>
          <ShieldCheck aria-hidden className="size-4" />
          {confirm.pending ? "Conferindo…" : "Ligar verificação"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export function MfaSection() {
  const toast = useToast();
  const factor = useAdminQuery(getMfaFactorId, "mfa-factor");
  const [enrollment, setEnrollment] = useState<MfaEnrollment | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const start = useMutation(startMfaEnrollment);
  const disable = useMutation(async (deps, factorId: string) => {
    await disableMfa(deps, factorId);
    return true;
  });

  const onStart = async () => {
    const started = await start.run();
    if (started) setEnrollment(started);
  };

  const onEnrolled = () => {
    setEnrollment(null);
    factor.reload();
    toast.show("Verificação em duas etapas ligada. O próximo login vai pedir o código.");
  };

  const onDisable = async (factorId: string) => {
    if (!(await disable.run(factorId))) return;
    setConfirmingDisable(false);
    factor.reload();
    toast.show("Verificação em duas etapas desligada.");
  };

  if (factor.status === "loading") {
    return (
      <FormSection title="Verificação em duas etapas" description={DESCRIPTION}>
        <p className="text-sm text-mist">Conferindo…</p>
      </FormSection>
    );
  }

  if (factor.status === "error") {
    return (
      <FormSection title="Verificação em duas etapas" description={DESCRIPTION}>
        <InlineError message={factor.error.message} />
        <Button type="button" variant="secondary" onClick={factor.reload}>
          Tentar de novo
        </Button>
      </FormSection>
    );
  }

  const factorId = factor.data;

  return (
    <FormSection title="Verificação em duas etapas" description={DESCRIPTION}>
      {factorId ? (
        <>
          <p className="flex items-center gap-2 text-sm text-white">
            <ShieldCheck aria-hidden className="size-5 text-emerald-300" />
            Ligada. Todo login neste e em outros aparelhos pede o código do app.
          </p>
          <Button type="button" variant="secondary" onClick={() => setConfirmingDisable(true)} className="max-sm:w-full">
            <ShieldOff aria-hidden className="size-4" /> Desligar
          </Button>
          <ConfirmDialog
            open={confirmingDisable}
            title="Desligar a verificação em duas etapas?"
            description="O login volta a pedir só a senha. Quem descobrir a senha entra no painel."
            confirmLabel="Desligar"
            pending={disable.pending}
            onConfirm={() => void onDisable(factorId)}
            onClose={() => setConfirmingDisable(false)}
          />
          {disable.error && <InlineError message={disable.error.message} />}
        </>
      ) : enrollment ? (
        <EnrollmentForm enrollment={enrollment} onDone={onEnrolled} onCancel={() => setEnrollment(null)} />
      ) : (
        <>
          <p className="text-sm text-fog">Desligada. Recomendado: leva um minuto e protege os dados dos clientes.</p>
          {start.error && <InlineError message={start.error.message} />}
          <Button type="button" onClick={() => void onStart()} disabled={start.pending} className="max-sm:w-full">
            <ShieldCheck aria-hidden className="size-4" />
            {start.pending ? "Preparando…" : "Ligar verificação em duas etapas"}
          </Button>
        </>
      )}
    </FormSection>
  );
}
