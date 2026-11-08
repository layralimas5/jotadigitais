import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import type { PageButton } from "@/domain/site-content";
import { whatsappMessageUrl } from "@/domain/store-settings";
import { buttonClasses } from "@/ui/components/Button";
import { WhatsAppGlyph } from "@/ui/components/whatsapp/WhatsAppGlyph";
import { useStoreSettings } from "@/ui/hooks/useStoreSettings";
import { cn } from "@/ui/lib/cn";
import { editable } from "@/ui/lib/site-preview";

const isInternal = (url: string) => url.startsWith("/");

/**
 * WhatsApp abre a conversa com o Jota e a mensagem pronta (sem número salvo, vai para o Instagram da loja).
 * Link leva a uma página do site na mesma aba ou a um endereço de fora em outra aba.
 */
function PageButtonLink({ button, labelPath, primary, className }: { button: PageButton; labelPath: string; primary: boolean; className?: string }) {
  const { whatsappUrl, instagramUrl } = useStoreSettings();
  const classes = buttonClasses({ size: "lg", variant: primary ? "primary" : "secondary", className });
  const label = <span {...editable(labelPath)}>{button.label}</span>;

  if (button.action === "link" && isInternal(button.url)) {
    return (
      <Link to={button.url} className={classes}>
        {label}
        <ArrowRight aria-hidden className="size-4" />
      </Link>
    );
  }
  const isWhatsapp = button.action === "whatsapp";
  const href = !isWhatsapp ? button.url : whatsappUrl ? whatsappMessageUrl(whatsappUrl, button.message) : instagramUrl;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
      {isWhatsapp && whatsappUrl && <WhatsAppGlyph aria-hidden className="size-4" />}
      {label}
      {isWhatsapp ? <ArrowRight aria-hidden className="size-4" /> : <ExternalLink aria-hidden className="size-4" />}
      <span className="sr-only"> (abre em outra aba)</span>
    </a>
  );
}

interface PageButtonsProps {
  buttons: readonly PageButton[];
  /** Caminho no editor do site ("partnerPage.buttons"), para o clique na prévia abrir o campo certo. */
  path: string;
  centered?: boolean;
  className?: string;
}

/** Botões editáveis de uma página do site: o primeiro em destaque, os outros secundários. */
export function PageButtons({ buttons, path, centered = false, className }: PageButtonsProps) {
  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:flex-wrap", centered && "sm:justify-center", className)}>
      {buttons.map((button, index) => (
        <PageButtonLink key={index} button={button} labelPath={`${path}.${index}.label`} primary={index === 0} className="w-full sm:w-auto" />
      ))}
    </div>
  );
}
