import { Eye, EyeOff, FlaskConical, RotateCcw } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { JOTA_SUBJECT, resetSandbox, useAdminView, type ViewMode, type ViewSubject } from "../admin-view";
import { useAdminSession } from "../session";
import { homePathFor } from "../navigation";

/** Troca entre o painel dela e ver ou testar como alguém; sempre abre a primeira tela de quem passa a ser visto. */
export function usePreviewToggle() {
  const { mode, previewing, testing, subject, viewAccess, enterPreview, enterSandbox, exitPreview } = useAdminView();
  const { state } = useAdminSession();
  const navigate = useNavigate();
  const ownAccess = state.status === "signed-in" ? { role: state.session.role, permissions: state.session.permissions } : viewAccess;
  const enterAs = (enter: (subject?: ViewSubject) => void) => (next?: ViewSubject) => {
    enter(next);
    navigate(homePathFor((next ?? subject).access));
  };
  return {
    mode,
    previewing,
    testing,
    subject,
    /** Vendo ou testando: em qualquer um dos dois ela está no painel de outra pessoa. */
    asSomeone: mode !== "self",
    enter: enterAs(enterPreview),
    enterSandbox: enterAs(enterSandbox),
    exit: () => {
      exitPreview();
      if (ownAccess) navigate(homePathFor(ownAccess));
    },
  };
}

/** Botões do dashboard da desenvolvedora: abre o painel como o Jota vê ou como ele usa. */
export function EnterPreviewButton({ className }: { className?: string }) {
  const { enter, enterSandbox } = usePreviewToggle();
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      <Button variant="secondary" onClick={() => enter(JOTA_SUBJECT)}>
        <Eye aria-hidden className="size-4" /> Ver como o Jota
      </Button>
      <Button variant="secondary" onClick={() => enterSandbox(JOTA_SUBJECT)}>
        <FlaskConical aria-hidden className="size-4" /> Testar como o Jota
      </Button>
    </div>
  );
}

const BANNER: Record<Exclude<ViewMode, "self">, { title: (name: string) => string; text: string; tone: string; icon: typeof Eye }> = {
  preview: {
    title: (name) => `Vendo como ${name}.`,
    text: "Dados reais, com os pessoais ocultos, e nada é salvo.",
    tone: "border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
    icon: Eye,
  },
  sandbox: {
    title: (name) => `Testando como ${name}.`,
    text: "Dados de exemplo só neste navegador: tudo funciona e nada vai para a loja de verdade.",
    tone: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100",
    icon: FlaskConical,
  },
};

const BANNER_BUTTON = "inline-flex items-center gap-1.5 rounded-full border border-current/40 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/10 hover:text-white";

/** Faixa no topo enquanto ela está no painel de outra pessoa: de quem, em qual modo e como trocar ou sair. */
export function PreviewBanner() {
  const { mode, subject, enter, enterSandbox, exit } = usePreviewToggle();
  if (mode === "self") return null;
  const { title, text, tone, icon: Icon } = BANNER[mode];
  const restart = () => {
    resetSandbox();
    // Os dados de exemplo ficam em memória nas telas abertas: recarregar começa o teste do zero.
    window.location.assign(homePathFor(subject.access));
  };
  return (
    <div role="status" className={cn("flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b px-4 py-2.5 text-sm sm:px-6 md:px-8", tone)}>
      <p className="flex items-center gap-2">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span>
          <strong className="font-semibold text-white">{title(subject.name)}</strong> {text}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        {mode === "preview" ? (
          <button type="button" onClick={() => enterSandbox()} className={BANNER_BUTTON}>
            <FlaskConical aria-hidden className="size-3.5" /> Testar como {subject.name}
          </button>
        ) : (
          <>
            <button type="button" onClick={restart} className={BANNER_BUTTON}>
              <RotateCcw aria-hidden className="size-3.5" /> Recomeçar o teste
            </button>
            <button type="button" onClick={() => enter()} className={BANNER_BUTTON}>
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
export function SidebarPreviewEntry({ className, iconOnly = false }: { className?: string; iconOnly?: boolean }) {
  const { asSomeone, testing, enter, enterSandbox, exit } = usePreviewToggle();
  const entry = cn(ENTRY, iconOnly && "justify-center px-0");
  const text = (label: string) => <span className={cn(iconOnly && "sr-only")}>{label}</span>;
  if (asSomeone) {
    return (
      <button
        type="button"
        onClick={exit}
        title={iconOnly ? "Voltar ao meu painel" : undefined}
        className={cn(
          entry,
          testing ? "border border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-100" : "border border-amber-300/30 bg-amber-300/[0.08] text-amber-100",
          "hover:text-white",
          className,
        )}
      >
        <EyeOff aria-hidden className="size-[1.1rem] shrink-0" /> {text("Voltar ao meu painel")}
      </button>
    );
  }
  return (
    <div className={cn("space-y-0.5", className)}>
      <button
        type="button"
        onClick={() => enter(JOTA_SUBJECT)}
        title={iconOnly ? "Ver como o Jota" : undefined}
        className={cn(entry, "text-mist hover:bg-white/[0.06] hover:text-white")}
      >
        <Eye aria-hidden className="size-[1.1rem] shrink-0" /> {text("Ver como o Jota")}
      </button>
      <button
        type="button"
        onClick={() => enterSandbox(JOTA_SUBJECT)}
        title={iconOnly ? "Testar como o Jota" : undefined}
        className={cn(entry, "text-mist hover:bg-white/[0.06] hover:text-white")}
      >
        <FlaskConical aria-hidden className="size-[1.1rem] shrink-0" /> {text("Testar como o Jota")}
      </button>
    </div>
  );
}
