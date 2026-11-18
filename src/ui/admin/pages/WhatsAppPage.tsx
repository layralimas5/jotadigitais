import { FlaskConical } from "lucide-react";
import { Suspense, lazy, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { getWhatsAppSettings } from "@/application/admin-use-cases";
import type { WhatsAppAiSettings } from "@/domain/whatsapp";
import { cn } from "@/ui/lib/cn";
import { AiSetupPanel } from "../automation/AiSetupPanel";
import { MessageTemplatesPanel } from "../automation/MessageTemplatesPanel";
import { WhatsAppDeliveryPanel } from "../automation/WhatsAppDeliveryPanel";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { useFocusLayout } from "../focus-layout";
import { useAdminQuery } from "../hooks";
import { InboxPanel } from "../whatsapp/InboxPanel";
import { TAB_PARAM, WHATSAPP_TABS, whatsAppTabOf, type WhatsAppTab } from "../whatsapp/links";
import { WhatsAppStatusBar } from "../whatsapp/WhatsAppStatusBar";
import { compactButton } from "../whatsapp/styles";

// O quadro de fluxos (React Flow) só baixa quando a aba Fluxos é aberta.
const FlowsPanel = lazy(() => import("../flows/FlowsPanel").then((module) => ({ default: module.FlowsPanel })));

const TAB_LABEL: Record<WhatsAppTab, string> = {
  conversas: "Conversas",
  fluxos: "Fluxos",
  ia: "IA de atendimento",
  entrega: "Entrega automática",
  mensagens: "Mensagens",
};

function Tabs({ value, onChange }: { value: WhatsAppTab; onChange: (tab: WhatsAppTab) => void }) {
  return (
    <div role="tablist" aria-label="Partes do WhatsApp" className="flex gap-5 overflow-x-auto border-b border-line [scrollbar-width:none]">
      {WHATSAPP_TABS.map((tab) => {
        const active = tab === value;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab)}
            className={cn(
              "-mb-px shrink-0 border-b-2 pt-1 pb-2.5 text-sm whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-electric",
              active ? "border-white font-medium text-white" : "border-transparent text-mist hover:text-fog",
            )}
          >
            {TAB_LABEL[tab]}
          </button>
        );
      })}
    </div>
  );
}

/** WhatsApp: conversas, fluxos que guiam a IA, a IA, a entrega automática e as mensagens, num lugar só. */
export default function WhatsAppPage() {
  const settings = useAdminQuery(getWhatsAppSettings, "whatsapp-settings");
  const [params, setParams] = useSearchParams();
  const tab = whatsAppTabOf(params.get(TAB_PARAM));
  const [simulating, setSimulating] = useState(false);
  const [conversationOpen, setConversationOpen] = useState(false);
  // A faixa de cima e a aba IA mexem na mesma configuração: uma conta para a outra o que mudou.
  const [aiFromBar, setAiFromBar] = useState<WhatsAppAiSettings | null>(null);
  const [aiFromForm, setAiFromForm] = useState<WhatsAppAiSettings | null>(null);
  // As abas pesadas só carregam quando abertas; depois ficam montadas para não perder o que está sendo editado.
  const [opened, setOpened] = useState<ReadonlySet<WhatsAppTab>>(() => new Set([tab]));
  useEffect(() => setOpened((current) => (current.has(tab) ? current : new Set([...current, tab]))), [tab]);
  // O quadro de fluxos usa a tela toda: o menu lateral encolhe enquanto a aba estiver aberta.
  useFocusLayout(tab === "fluxos");

  const setTab = (next: WhatsAppTab) => {
    const nextParams = new URLSearchParams(params);
    if (next === "conversas") nextParams.delete(TAB_PARAM);
    else nextParams.set(TAB_PARAM, next);
    setParams(nextParams, { replace: true });
  };

  const mode = settings.status === "success" ? settings.data.mode : "test";
  const hideTop = tab === "conversas" && conversationOpen;

  return (
    <div className="space-y-5">
      <div className={cn("space-y-5", hideTop && "max-md:hidden")}>
        <PageHeader
          title="WhatsApp"
          description="Conversas, os fluxos que guiam a IA e a entrega automática."
          action={
            tab === "conversas" &&
            mode === "test" && (
              <button type="button" className={compactButton.secondary} onClick={() => setSimulating(true)}>
                <FlaskConical aria-hidden className="size-3.5" /> Simular cliente
              </button>
            )
          }
        />
        <WhatsAppStatusBar onAiChange={setAiFromBar} saved={aiFromForm} />
        <Tabs value={tab} onChange={setTab} />
      </div>

      <div hidden={tab !== "conversas"}>
        {opened.has("conversas") && <InboxPanel simulating={simulating} onSimulatingChange={setSimulating} onOpenChange={setConversationOpen} />}
      </div>
      <div hidden={tab !== "fluxos"}>
        {opened.has("fluxos") && (
          <Suspense fallback={<LoadingBlock />}>
            <FlowsPanel />
          </Suspense>
        )}
      </div>
      <div hidden={tab !== "ia"}>
        {opened.has("ia") && <AiSetupPanel enabledOverride={aiFromBar?.enabled ?? null} onSaved={setAiFromForm} />}
      </div>
      <div hidden={tab !== "entrega"} className="max-w-[68rem]">
        {opened.has("entrega") && <WhatsAppDeliveryPanel />}
      </div>
      <div hidden={tab !== "mensagens"} className="max-w-[68rem] space-y-6">
        {opened.has("mensagens") && <MessageTemplatesPanel />}
      </div>
    </div>
  );
}
