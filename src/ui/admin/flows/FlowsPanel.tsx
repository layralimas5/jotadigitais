import { LayoutTemplate, Plus, Square } from "lucide-react";
import { useCallback, useState } from "react";
import { listWhatsAppFlows } from "@/application/admin-use-cases";
import { blankGraph, templateGraph, type WhatsAppFlow } from "@/domain/whatsapp-flow";
import { ErrorState } from "@/ui/components/StateViews";
import { cn } from "@/ui/lib/cn";
import { LoadingBlock } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { useAdminQuery } from "../hooks";
import { compactButton } from "../whatsapp/styles";
import { FlowEditor } from "./FlowEditor";

type Draft = { name: string; graph: WhatsAppFlow["graph"] };
type Selection = { kind: "saved"; id: string } | { kind: "new"; draft: Draft };

const TEMPLATE_NAME = "Atendimento inicial";

function StartChoices({ onPick }: { onPick: (draft: Draft) => void }) {
  const choices = [
    {
      icon: LayoutTemplate,
      title: "Começar pelo modelo pronto",
      text: "Boas-vindas, menu com Comprar, Já comprei e Ser afiliado, e o caminho de cada um. É só ajustar os textos.",
      draft: () => ({ name: TEMPLATE_NAME, graph: templateGraph() }),
    },
    {
      icon: Square,
      title: "Começar em branco",
      text: "Só o bloco de início. Bom para um fluxo curto, como uma palavra-chave de promoção.",
      draft: () => ({ name: "Novo fluxo", graph: blankGraph() }),
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {choices.map(({ icon: Icon, title, text, draft }) => (
        <button
          key={title}
          type="button"
          onClick={() => onPick(draft())}
          className="group rounded-xl border border-line bg-surface/40 p-5 text-left transition-colors hover:border-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-electric"
        >
          <Icon aria-hidden className="size-5 text-mist transition-colors group-hover:text-white" />
          <p className="mt-3 text-sm font-semibold text-white">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-mist">{text}</p>
        </button>
      ))}
    </div>
  );
}

/** Automação > Fluxos: os passo a passos do WhatsApp, cada um desenhado num quadro. */
export function FlowsPanel() {
  const flows = useAdminQuery(listWhatsAppFlows, "whatsapp-flows");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<Selection | "menu" | null>(null);
  const [showChoices, setShowChoices] = useState(false);
  // Recém-salvo: aparece na hora, antes de a lista voltar do banco.
  const [justSaved, setJustSaved] = useState<WhatsAppFlow | null>(null);
  const onDirtyChange = useCallback((next: boolean) => setDirty(next), []);

  if (flows.status === "loading") return <LoadingBlock />;
  if (flows.status === "error") return <ErrorState message={flows.error.message} onRetry={flows.reload} />;
  const list = flows.data;

  const open = (next: Selection) => {
    setSelection(next);
    setEditorKey((key) => key + 1);
    setShowChoices(false);
    setDirty(next.kind === "new");
  };
  const request = (next: Selection | "menu") => {
    if (dirty) {
      setPending(next);
      return;
    }
    if (next === "menu") setShowChoices(true);
    else open(next);
  };

  // Sem escolha ainda: abre o primeiro fluxo salvo.
  const current: Selection | null = selection ?? (list[0] ? { kind: "saved", id: list[0].id } : null);
  const savedFlow =
    current?.kind === "saved" ? (list.find((flow) => flow.id === current.id) ?? (justSaved?.id === current.id ? justSaved : null)) : null;

  if (list.length === 0 && current?.kind !== "new") {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Monte o passo a passo do WhatsApp</h2>
          <p className="mt-1 text-xs leading-relaxed text-mist">
            Blocos ligados por setas: mensagem, pergunta com botões, condição, IA e chamar você. O fluxo responde antes da IA e só roda quando
            estiver ligado.
          </p>
        </div>
        <StartChoices onPick={(draft) => open({ kind: "new", draft })} />
      </div>
    );
  }

  const switcher = (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Fluxos">
      {list.map((flow) => {
        const active = current?.kind === "saved" && current.id === flow.id;
        return (
          <button
            key={flow.id}
            type="button"
            aria-pressed={active}
            onClick={() => !active && request({ kind: "saved", id: flow.id })}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-md px-3 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-electric",
              active ? "bg-white/[0.08] text-white" : "text-mist hover:bg-white/[0.04] hover:text-fog",
            )}
          >
            <span aria-hidden className={cn("size-1.5 rounded-full", flow.enabled ? "bg-emerald-400" : "bg-line-strong")} />
            {flow.name}
            <span className="sr-only">{flow.enabled ? "(ligado)" : "(desligado)"}</span>
          </button>
        );
      })}
      {current?.kind === "new" && (
        <span className="inline-flex h-8 items-center gap-2 rounded-md bg-white/[0.08] px-3 text-xs font-medium text-white">
          <span aria-hidden className="size-1.5 rounded-full bg-amber-300" />
          {current.draft.name} (novo)
        </span>
      )}
      <button type="button" onClick={() => request("menu")} className={cn(compactButton.icon, "w-auto px-2.5")}>
        <Plus aria-hidden className="size-3.5" /> Novo fluxo
      </button>
    </div>
  );

  return (
    <div className="space-y-4">
      {(showChoices || !current || (current.kind === "saved" && !savedFlow)) && switcher}
      {showChoices && <StartChoices onPick={(draft) => open({ kind: "new", draft })} />}

      {current && (current.kind === "new" || savedFlow) && (
        <FlowEditor
          key={editorKey}
          switcher={showChoices ? undefined : switcher}
          flow={savedFlow}
          draft={current.kind === "new" ? current.draft : undefined}
          onDirtyChange={onDirtyChange}
          onSaved={(saved) => {
            setJustSaved(saved);
            flows.reload();
            setSelection({ kind: "saved", id: saved.id });
          }}
          onDeleted={() => {
            flows.reload();
            setSelection(null);
            setEditorKey((key) => key + 1);
            setDirty(false);
          }}
        />
      )}

      <ConfirmDialog
        open={pending !== null}
        title="Descartar o que não foi salvo?"
        description="As mudanças neste fluxo vão se perder."
        confirmLabel="Descartar"
        onConfirm={() => {
          const next = pending;
          setPending(null);
          setDirty(false);
          if (next === "menu") setShowChoices(true);
          else if (next) open(next);
        }}
        onClose={() => setPending(null)}
      />
    </div>
  );
}
