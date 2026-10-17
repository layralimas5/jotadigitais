import { AlertCircle, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/ui/components/Button";
import { cn } from "@/ui/lib/cn";
import { MobileActionBar } from "./AdminUi";

interface FormFooterProps {
  /** Texto do botão principal, já no estado certo ("Salvar alterações", "Cadastrar cliente"). */
  submitLabel: string;
  /** Versão curta para a barra do celular. Sem ela, usa `submitLabel`. */
  mobileSubmitLabel?: string;
  pendingLabel?: string;
  pending: boolean;
  submitIcon?: ReactNode;
  /** Volta para a lista. Sem ele, não há botão de cancelar (ex.: telas de configuração). */
  onCancel?: () => void;
  /** Ação destrutiva da ficha, sempre à esquerda e longe do botão principal. */
  onDelete?: () => void;
  deleteLabel?: string;
  /** Ações extras ao lado do cancelar (ex.: enviar pelo WhatsApp). */
  extraActions?: ReactNode;
  /** Mensagens de erro; mostra a primeira que existir. */
  errors?: readonly (string | null | undefined)[];
  className?: string;
}

/**
 * Barra de ações no rodapé das fichas. No computador acompanha a rolagem colada embaixo da tela;
 * no celular vira a barra fixa de Voltar/Salvar e o resto fica no fim da ficha.
 */
export function FormFooter({
  submitLabel,
  mobileSubmitLabel,
  pendingLabel = "Salvando…",
  pending,
  submitIcon,
  onCancel,
  onDelete,
  deleteLabel = "Apagar",
  extraActions,
  errors = [],
  className,
}: FormFooterProps) {
  const error = errors.find((message): message is string => Boolean(message));
  const hasLeadingContent = Boolean(onDelete || error || extraActions);

  return (
    <>
      <div
        className={cn(
          "z-20 md:sticky md:bottom-4",
          !hasLeadingContent && "max-md:hidden",
          className,
        )}
      >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4 md:rounded-2xl md:border md:border-line-strong md:bg-surface-2/90 md:px-4 md:py-3 md:shadow-[0_20px_50px_-20px_rgb(0_0_0/0.9)] md:backdrop-blur-xl">
          <div className="flex min-w-0 flex-1 flex-col gap-2 max-md:order-last md:flex-row md:items-center md:gap-3">
            {onDelete && (
              <Button
                variant="ghost"
                className="text-[#ff7a7a] hover:bg-alert/10 hover:text-[#ff9a9a] max-md:order-last max-md:w-full"
                onClick={onDelete}
              >
                <Trash2 aria-hidden className="size-4" /> {deleteLabel}
              </Button>
            )}
            {error && (
              <p role="alert" className="flex min-w-0 items-center gap-2 text-sm text-[#ff9a9a]">
                <AlertCircle aria-hidden className="size-4 shrink-0" />
                <span className="truncate md:whitespace-normal">{error}</span>
              </p>
            )}
          </div>
          <div className={cn("flex flex-col gap-2 md:flex-row md:items-center", !extraActions && "max-md:hidden")}>
            {extraActions}
            {onCancel && (
              <Button variant="secondary" className="max-md:hidden" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button type="submit" className="max-md:hidden" disabled={pending}>
              {submitIcon}
              {pending ? pendingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </div>

      <MobileActionBar>
        {onCancel && (
          <Button variant="secondary" size="lg" className="shrink-0" onClick={onCancel}>
            Voltar
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={pending}>
          {pending ? pendingLabel : (mobileSubmitLabel ?? submitLabel)}
        </Button>
      </MobileActionBar>
    </>
  );
}
