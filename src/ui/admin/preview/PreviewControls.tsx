import { Eye, EyeOff, FlaskConical, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { resetSandbox, useAdminView, type ViewMode } from "../admin-view";
import { HOME_PATH } from "../navigation";

/** Troca entre o painel dela, ver como o Jota e testar como o Jota; sempre volta para o dashboard, que existe em todos. */
export function usePreviewToggle() {
  const { mode, previewing, testing, enterPreview, enterSandbox, exitPreview } = useAdminView();
  const navigate = useNavigate();
  const go = (action: () => void) => () => {
    action();
    navigate(HOME_PATH);
  };
  return {
    mode,
    previewing,
    testing,
    /** Vendo ou testando: em qualquer um dos dois ela está no painel do Jota. */
    asJota: mode !== "self",
    enter: go(enterPreview),
    enterSandbox: go(enterSandbox),
    exit: go(exitPreview),
  };
}

/** Botões do dashboard da desenvolvedora: abre o painel como o Jota vê ou como ele usa. */
export function EnterPreviewButton({ className }: { className?: string }) {
  const { enter, enterSandbox } = usePreviewToggle();
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="secondary" onClick={enter}>
        <Eye aria-hidden className="size-4" /> Ver como o Jota
      </Button>
      <Button variant="secondary" onClick={enterSandbox}>
        <FlaskConical aria-hidden className="size-4" /> Testar como o Jota
      </Button>
    </div>
  );
}

const BANNER: Record<Exclude<ViewMode, "self">, { title: string; text: string; tone: string; icon: typeof Eye }> = {
  preview: {
    title: "Vendo como o Jota.",
    text: "Dados reais, com os pessoais ocultos, e nada é salvo.",
    tone: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
    icon: Eye,
  },
  sandbox: {
    title: "Testando como o Jota.",
    text: "Dados de exemplo só neste navegador: tudo funciona e nada vai para a loja de verdade.",
    tone: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100",
    icon: FlaskConical,
  },
};

const BANNER_BUTTON = "inline-flex items-center gap-1.5 rounded-full border border-current/40 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/10 hover:text-white";

/** Faixa no topo enquanto ela está no painel do Jota: diz em qual modo está e como trocar ou sair. */
export function PreviewBanner() {
  const { mode, enter, enterSandbox, exit } = usePreviewToggle();
  if (mode === "self") return null;
  const { title, text, tone, icon: Icon } = BANNER[mode];
  const restart = () => {
    resetSandbox();
    // Os dados de exemplo ficam em memória nas telas abertas: recarregar começa o teste do zero.
    window.location.assign(HOME_PATH);
  };
  return (
    <div role="status" className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5 text-sm sm:px-6 md:px-8", tone)}>
      <p className="flex items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span>
          <strong className="font-semibold text-white">{title}</strong> {text}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {mode === "preview" ? (
          <button type="button" onClick={enterSandbox} className={BANNER_BUTTON}>
            <FlaskConical aria-hidden className="size-3.5" /> Testar como o Jota
          </button>
        ) : (
          <>
            <button type="button" onClick={restart} className={BANNER_BUTTON}>
              <RotateCcw aria-hidden className="size-3.5" /> Recomeçar o teste
            </button>
            <button type="button" onClick={enter} className={BANNER_BUTTON}>
              <Eye aria-hidden className="size-3.5" /> Ver dados reais
            </button>
          </>
        )}
        <button type="button" onClick={exit} className={BANNER_BUTTON}>
          <EyeOff aria-hidden className="size-3.5" /> Voltar ao meu painel
        </button>
      </div>
    </div>
  );
}

const ENTRY = "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors";

/** Atalhos no menu lateral da desenvolvedora, abaixo das seções. */
export function SidebarPreviewEntry({ className }: { className?: string }) {
  const { asJota, testing, enter, enterSandbox, exit } = usePreviewToggle();
  if (asJota) {
    return (
      <button
        type="button"
        onClick={exit}
        className={cn(
          ENTRY,
          testing ? "border border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100" : "border border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
          "hover:text-white",
          className,
        )}
      >
        <EyeOff aria-hidden className="size-[1.1rem]" /> Voltar ao meu painel
      </button>
    );
  }
  return (
    <div className={cn("space-y-0.5", className)}>
      <button type="button" onClick={enter} className={cn(ENTRY, "text-mist hover:bg-white/[0.06] hover:text-white")}>
        <Eye aria-hidden className="size-[1.1rem]" /> Ver como o Jota
      </button>
      <button type="button" onClick={enterSandbox} className={cn(ENTRY, "text-mist hover:bg-white/[0.06] hover:text-white")}>
        <FlaskConical aria-hidden className="size-[1.1rem]" /> Testar como o Jota
      </button>
    </div>
  );
}
