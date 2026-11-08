import { LEGAL_LIMITS, type LegalSectionDraft } from "@/domain/legal/legal-editing";
import { CopyField, Repeater, type FieldErrors } from "../fields";
import { TextAreaField } from "../../components/FormControls";

const MARKUP_HINTS: readonly { example: string; meaning: string }[] = [
  { example: "Linha em branco", meaning: "separa um parágrafo do outro" },
  { example: "- item", meaning: "lista com marcadores (uma linha por item)" },
  { example: "! texto", meaning: "parágrafo em destaque, numa caixa" },
  { example: "Nome | valor", meaning: "tabela de duas colunas (uma linha por item)" },
  { example: "[texto](https://...)", meaning: "link; para página do site, use /meus-dados" },
  { example: "{{legalName}}", meaning: "dado da empresa, preenchido logo abaixo" },
];

/** Como escrever o texto de uma seção: cabe numa caixa, sem editor complicado. */
function MarkupHelp() {
  return (
    <details className="rounded-2xl border border-line bg-ink/60 px-4 py-3 text-sm text-mist">
      <summary className="cursor-pointer font-medium text-fog">Como formatar o texto das seções</summary>
      <dl className="mt-3 grid gap-x-4 gap-y-1.5 sm:grid-cols-[auto_1fr]">
        {MARKUP_HINTS.map((hint) => (
          <div key={hint.example} className="contents">
            <dt>
              <code className="rounded bg-surface px-1.5 py-0.5 text-xs text-white">{hint.example}</code>
            </dt>
            <dd>{hint.meaning}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}

const linesOf = (text: string) => Math.min(18, Math.max(5, text.split("\n").length + 1));

interface LegalSectionsFieldProps {
  sections: LegalSectionDraft[];
  errors: FieldErrors;
  onChange: (sections: LegalSectionDraft[]) => void;
}

export function LegalSectionsField({ sections, errors, onChange }: LegalSectionsFieldProps) {
  return (
    <>
      <MarkupHelp />
      <Repeater
        legend="Seções do documento"
        path="sections"
        items={sections}
        onChange={onChange}
        errors={errors}
        min={1}
        max={LEGAL_LIMITS.sections}
        addLabel="Adicionar seção"
        itemLabel={(index) => `Seção ${index + 1}`}
        empty={() => ({ id: "", title: "", text: "" })}
        render={(section, update, path) => (
          <>
            <CopyField
              label="Título da seção"
              path={`${path}.title`}
              value={section.title}
              max={LEGAL_LIMITS.sectionTitle}
              errors={errors}
              onChange={(title) => update({ title })}
            />
            <TextAreaField
              label="Texto"
              name={`${path}.text`}
              rows={linesOf(section.text)}
              maxLength={LEGAL_LIMITS.sectionText}
              value={section.text}
              error={errors[`${path}.text`]}
              onChange={(event) => update({ text: event.target.value })}
            />
          </>
        )}
      />
    </>
  );
}
