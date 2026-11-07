import { Eye, EyeOff } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { useAdminView } from "../admin-view";
import { HOME_PATH } from "../navigation";

/** Liga e desliga o modo visualização e sempre volta para o dashboard, que existe nos dois painéis. */
export function usePreviewToggle() {
  const { previewing, enterPreview, exitPreview } = useAdminView();
  const navigate = useNavigate();
  return {
    previewing,
    enter: () => {
      enterPreview();
      navigate(HOME_PATH);
    },
    exit: () => {
      exitPreview();
      navigate(HOME_PATH);
    },
  };
}

/** Botão do dashboard da desenvolvedora: abre o painel como o Jota vê. */
export function EnterPreviewButton({ className }: { className?: string }) {
  const { enter } = usePreviewToggle();
  return (
    <Button variant="secondary" onClick={enter} className={className}>
      <Eye aria-hidden className="size-4" /> Ver como o Jota
    </Button>
  );
}

/** Faixa no topo enquanto ela vê o painel do Jota: deixa claro que é só visualização e como sair. */
export function PreviewBanner() {
  const { exit } = usePreviewToggle();
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-amber-300/30 bg-amber-300/[0.08] px-4 py-2.5 text-sm sm:px-6 md:px-8"
    >
      <p className="flex items-center gap-2 text-amber-100">
        <Eye aria-hidden className="size-4 shrink-0 text-amber-300" />
        <span>
          <strong className="font-semibold text-white">Vendo como o Jota.</strong> Dados pessoais ocultos e nada é salvo.
        </span>
      </p>
      <button
        type="button"
        onClick={exit}
        className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 px-3 py-1 text-xs font-semibold text-amber-100 transition-colors hover:bg-amber-300/15 hover:text-white"
      >
        <EyeOff aria-hidden className="size-3.5" /> Voltar ao meu painel
      </button>
    </div>
  );
}

/** Atalho no menu lateral da desenvolvedora, abaixo das seções. */
export function SidebarPreviewEntry({ className }: { className?: string }) {
  const { previewing, enter, exit } = usePreviewToggle();
  const Icon = previewing ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={previewing ? exit : enter}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors",
        previewing ? "border border-amber-300/30 bg-amber-300/[0.08] text-amber-100 hover:text-white" : "text-mist hover:bg-white/[0.06] hover:text-white",
        className,
      )}
    >
      <Icon aria-hidden className="size-[1.1rem]" />
      {previewing ? "Voltar ao meu painel" : "Ver como o Jota"}
    </button>
  );
}
