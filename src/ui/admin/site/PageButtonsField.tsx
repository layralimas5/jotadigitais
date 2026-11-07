import { Link2 } from "lucide-react";
import type { ReactNode } from "react";
import { MAX_PAGE_BUTTONS, type PageButton, type PageButtonAction } from "@/domain/site-content";
import { WhatsAppGlyph } from "@/ui/components/whatsapp/WhatsAppGlyph";
import { SegmentedField } from "../components/FormControls";
import { CopyField, Repeater, type FieldErrors } from "./fields";

interface PageButtonsFieldProps {
  path: string;
  buttons: PageButton[];
  onChange: (buttons: PageButton[]) => void;
  errors: FieldErrors;
}

const ACTION_OPTIONS: { value: PageButtonAction; label: string; icon: ReactNode }[] = [
  { value: "whatsapp", label: "WhatsApp", icon: <WhatsAppGlyph aria-hidden className="size-4 text-[#25d366]" /> },
  { value: "link", label: "Link", icon: <Link2 aria-hidden className="size-4" /> },
];

const emptyButton = (): PageButton => ({ label: "", action: "whatsapp", message: "", url: "" });

/** Botões da página: cada um abre o WhatsApp com mensagem pronta ou leva a um link. O primeiro é o destaque. */
export function PageButtonsField({ path, buttons, onChange, errors }: PageButtonsFieldProps) {
  return (
    <Repeater
      legend="Botões"
      path={path}
      items={buttons}
      onChange={onChange}
      errors={errors}
      min={1}
      max={MAX_PAGE_BUTTONS}
      addLabel="Adicionar botão"
      itemLabel={(index) => (index === 0 ? "Botão 1 (destaque)" : `Botão ${index + 1}`)}
      empty={emptyButton}
      render={(button, update, itemPath) => (
        <>
          <CopyField label="Texto do botão" path={`${itemPath}.label`} value={button.label} max={32} errors={errors} onChange={(label) => update({ label })} />
          <SegmentedField
            legend="Ao clicar"
            name={`${itemPath}.action`}
            value={button.action}
            options={ACTION_OPTIONS}
            onChange={(action) => update({ action })}
          />
          {button.action === "whatsapp" ? (
            <CopyField
              label="Mensagem que já vai escrita"
              path={`${itemPath}.message`}
              value={button.message}
              max={300}
              multiline
              errors={errors}
              hint="Vai para o WhatsApp do suporte (Contato e garantia). Sem número salvo, o botão leva ao Instagram da loja."
              onChange={(message) => update({ message })}
            />
          ) : (
            <CopyField
              label="Endereço"
              path={`${itemPath}.url`}
              value={button.url}
              max={300}
              errors={errors}
              hint="Uma página do site, como /catalogo, ou um endereço completo, como https://instagram.com/... (abre em outra aba)."
              onChange={(url) => update({ url })}
            />
          )}
        </>
      )}
    />
  );
}
