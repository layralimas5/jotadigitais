import { Download, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import { LEGAL_CONTROLLER } from "@/application/legal-documents";
import { Button } from "@/ui/components/Button";
import { MissingField } from "@/ui/components/legal/LegalText";
import { PendingControllerNotice } from "@/ui/components/legal/PendingControllerNotice";
import { useDocumentMeta } from "@/ui/hooks/useDocumentMeta";
import { useMyData } from "@/ui/hooks/useMyData";
import { downloadJson } from "@/ui/lib/download";
import { AccessForm } from "@/ui/sections/my-data/AccessForm";
import { DataRequestForm } from "@/ui/sections/my-data/DataRequestForm";
import { SubjectDataView } from "@/ui/sections/my-data/SubjectDataView";

function PrivacyEmail() {
  return LEGAL_CONTROLLER.privacyEmail ? (
    <a href={`mailto:${LEGAL_CONTROLLER.privacyEmail}`} className="text-electric-soft underline underline-offset-4">
      {LEGAL_CONTROLLER.privacyEmail}
    </a>
  ) : (
    <MissingField label="e-mail para assuntos de privacidade" />
  );
}

export default function MyDataPage() {
  useDocumentMeta("Meus dados", "Veja, baixe, corrija ou peça a exclusão dos dados que a Jota Digitais guarda sobre você (LGPD, art. 18).");
  const { state, enter, leave, request } = useMyData();

  return (
    <div className="pt-28 pb-24 md:pt-36">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <p className="font-display text-xs font-semibold tracking-[0.2em] text-electric uppercase">Privacidade</p>
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-tight text-white md:text-5xl">Meus dados</h1>
        <p className="mt-4 text-lg leading-relaxed text-fog">
          Veja tudo o que guardamos sobre você, baixe uma cópia e peça correção, exclusão ou qualquer outro direito da LGPD.
          Respondemos em até 15 dias.
        </p>
        <div className="mt-8">
          <PendingControllerNotice />
        </div>

        <div className="mt-8">
          {state.status !== "ready" ? (
            <AccessForm
              pending={state.status === "loading"}
              error={state.status === "error" ? state.message : null}
              fieldErrors={state.status === "error" ? state.fieldErrors : {}}
              onSubmit={enter}
            />
          ) : (
            <div className="space-y-12">
              <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <p className="text-sm text-mist">
                  Dados ligados a <span className="font-semibold break-all text-white">{state.data.email}</span>
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button onClick={() => downloadJson(`meus-dados-jota-digitais-${state.data.generatedAt.slice(0, 10)}.json`, state.data)}>
                    <Download aria-hidden className="size-4" /> Baixar meus dados
                  </Button>
                  <Button variant="secondary" onClick={leave}>
                    <LogOut aria-hidden className="size-4" /> Sair
                  </Button>
                </div>
              </div>

              <section aria-labelledby="o-que-temos">
                <h2 id="o-que-temos" className="font-display text-2xl font-semibold text-white">
                  O que temos sobre você
                </h2>
                <p className="mt-2 text-sm text-mist">
                  O arquivo baixado traz tudo isto em formato aberto (JSON), que serve também para a portabilidade.
                </p>
                <div className="mt-6">
                  <SubjectDataView data={state.data} />
                </div>
              </section>

              <section aria-labelledby="pedir" className="rounded-3xl border border-line bg-surface/60 p-5 sm:p-7">
                <h2 id="pedir" className="font-display text-2xl font-semibold text-white">
                  Exercer um direito
                </h2>
                <p className="mt-2 text-sm text-mist">
                  Cada pedido gera um protocolo. O que a lei manda guardar, como os dados da nota fiscal, não pode ser apagado
                  antes do prazo, e explicamos isso na resposta.
                </p>
                <div className="mt-6">
                  <DataRequestForm onSubmit={request} />
                </div>
              </section>
            </div>
          )}
        </div>

        <p className="mt-10 text-sm leading-relaxed text-mist">
          Nunca comprou, mas falou com a gente no WhatsApp ou no Instagram? Escreva para <PrivacyEmail /> e confirmamos a sua
          identidade pelo mesmo canal. Entenda como tratamos os dados na{" "}
          <Link to="/politica-de-privacidade" className="text-electric-soft underline underline-offset-4">
            Política de Privacidade
          </Link>
          . Se não ficar satisfeito, você pode reclamar à{" "}
          <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer" className="text-electric-soft underline underline-offset-4">
            ANPD<span className="sr-only"> (abre em outra aba)</span>
          </a>
          .
        </p>
      </div>
    </div>
  );
}
