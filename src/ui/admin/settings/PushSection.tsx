import { BellOff, BellRing, Download, Send, Share, SquarePlus } from "lucide-react";
import { useState } from "react";
import { disablePush, enablePush, loadPushSettings, savePushKinds, sendTestPush, type PushSettings } from "@/application/push-use-cases";
import { canUseStoreArea, type StaffAccess } from "@/domain/admin-user";
import { pushKindsFor, type PushDeviceStatus, type PushKind } from "@/domain/push";
import { Button } from "@/ui/components/Button";
import { FormSection, InlineError } from "../components/AdminUi";
import { ToggleField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { plimEnabled, playPlim, setPlimEnabled } from "../pwa/plim";
import { useInstallPrompt } from "../pwa/usePanelApp";
import { useToast } from "../toast";

const TITLE = "Notificações no celular";
const DESCRIPTION = "Venda nova, pagamento confirmado e pendências chegam no celular com som, até com a tela bloqueada e o painel fechado.";

function IphoneInstallSteps() {
  return (
    <div className="space-y-3 text-sm text-fog">
      <p className="text-white">No iPhone, o aviso só funciona com o painel instalado na Tela de Início:</p>
      <ol className="list-decimal space-y-1.5 pl-5">
        <li>
          Abra este painel no <strong className="text-white">Safari</strong>.
        </li>
        <li>
          Toque em <Share aria-label="Compartilhar" className="inline size-4 align-text-bottom text-electric" /> Compartilhar e depois em{" "}
          <SquarePlus aria-hidden className="inline size-4 align-text-bottom text-electric" /> <strong className="text-white">Adicionar à Tela de Início</strong>.
        </li>
        <li>Abra o Jota pelo ícone novo, entre e volte aqui em Configurações para ligar.</li>
      </ol>
      <p className="text-xs text-mist">Precisa do iOS 16.4 ou mais novo (Ajustes, Geral, Sobre).</p>
    </div>
  );
}

function InstallAppButton() {
  const install = useInstallPrompt();
  if (!install) return null;
  return (
    <Button type="button" variant="secondary" onClick={() => void install()} className="max-sm:w-full">
      <Download aria-hidden className="size-4" /> Instalar o painel como app
    </Button>
  );
}

function DeviceControls({ status, onChanged }: { status: PushDeviceStatus; onChanged: () => void }) {
  const toast = useToast();
  const enable = useMutation(async (deps) => {
    await enablePush(deps);
    return true;
  });
  const disable = useMutation(async (deps) => {
    await disablePush(deps);
    return true;
  });
  const test = useMutation(async (deps) => {
    await sendTestPush(deps);
    return true;
  });

  if (status === "needs-install") return <IphoneInstallSteps />;
  if (status === "unsupported") {
    return (
      <p className="text-sm text-fog">
        Este navegador não recebe notificações. No Android use o Chrome; no iPhone, o Safari com o painel adicionado à Tela de Início.
      </p>
    );
  }
  if (status === "blocked") {
    return (
      <p role="status" className="text-sm text-fog">
        As notificações estão bloqueadas neste aparelho. Libere em Ajustes do navegador (Notificações, permitir para este site) e recarregue a
        página.
      </p>
    );
  }

  const error = enable.error ?? disable.error ?? test.error;

  if (status === "off") {
    return (
      <>
        <p className="text-sm text-fog">Desligado neste aparelho. Ligue em cada celular ou computador onde quer receber.</p>
        {error && <InlineError message={error.message} />}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            disabled={enable.pending}
            className="max-sm:w-full"
            onClick={async () => {
              if (!(await enable.run())) return;
              toast.show("Avisos ligados neste aparelho.");
              onChanged();
            }}
          >
            <BellRing aria-hidden className="size-4" /> {enable.pending ? "Ligando…" : "Ligar avisos neste aparelho"}
          </Button>
          <InstallAppButton />
        </div>
      </>
    );
  }

  return (
    <>
      <p className="flex items-center gap-2 text-sm text-white">
        <BellRing aria-hidden className="size-5 text-emerald-300" /> Ligado neste aparelho.
      </p>
      {error && <InlineError message={error.message} />}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          type="button"
          disabled={test.pending}
          className="max-sm:w-full"
          onClick={async () => {
            if (await test.run()) toast.show("Teste enviado. Deve chegar em alguns segundos.");
          }}
        >
          <Send aria-hidden className="size-4" /> {test.pending ? "Enviando…" : "Enviar teste"}
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={disable.pending}
          className="max-sm:w-full"
          onClick={async () => {
            if (!(await disable.run())) return;
            toast.show("Avisos desligados neste aparelho.");
            onChanged();
          }}
        >
          <BellOff aria-hidden className="size-4" /> Desligar neste aparelho
        </Button>
        <InstallAppButton />
      </div>
    </>
  );
}

function KindToggles({ access, initial }: { access: StaffAccess; initial: PushKind[] }) {
  const toast = useToast();
  const [kinds, setKinds] = useState(initial);
  const save = useMutation((deps, next: PushKind[]) => savePushKinds(deps, access, next).then(() => true));
  const options = pushKindsFor(access);

  const toggle = async (kind: PushKind, on: boolean) => {
    const previous = kinds;
    const next = on ? [...kinds, kind] : kinds.filter((item) => item !== kind);
    setKinds(next);
    if (!(await save.run(next))) {
      setKinds(previous);
      toast.show("Não foi possível salvar agora. Tente de novo.", "error");
    }
  };

  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium text-fog">O que chega no celular</legend>
      {options.map((option) => (
        <ToggleField
          key={option.kind}
          label={option.label}
          description={option.description}
          checked={kinds.includes(option.kind)}
          onChange={(on) => void toggle(option.kind, on)}
        />
      ))}
    </fieldset>
  );
}

function PlimToggle() {
  const [on, setOn] = useState(plimEnabled);
  return (
    <ToggleField
      label="Som com o painel aberto"
      description="Um plim quando chega aviso novo no sininho enquanto você usa o painel."
      checked={on}
      onChange={(next) => {
        setPlimEnabled(next);
        setOn(next);
        if (next) playPlim();
      }}
    />
  );
}

function PushContent({ access, settings, reload }: { access: StaffAccess; settings: PushSettings; reload: () => void }) {
  return (
    <>
      <DeviceControls status={settings.status} onChanged={reload} />
      <KindToggles access={access} initial={settings.kinds} />
      {canUseStoreArea(access, "orders") && <PlimToggle />}
    </>
  );
}

export function PushSection({ access }: { access: StaffAccess }) {
  const settings = useAdminQuery((deps) => loadPushSettings(deps, access), "push-settings");
  if (pushKindsFor(access).length === 0) return null;

  return (
    <FormSection title={TITLE} description={DESCRIPTION}>
      {settings.status === "loading" && <p className="text-sm text-mist">Conferindo este aparelho…</p>}
      {settings.status === "error" && (
        <>
          <InlineError message={settings.error.message} />
          <Button type="button" variant="secondary" onClick={settings.reload}>
            Tentar de novo
          </Button>
        </>
      )}
      {settings.status === "success" && <PushContent access={access} settings={settings.data} reload={settings.reload} />}
    </FormSection>
  );
}
