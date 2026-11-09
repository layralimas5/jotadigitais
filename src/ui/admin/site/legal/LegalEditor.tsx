import { Eye, EyeOff, Send } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";
import { publishLegalDocuments } from "@/application/admin-use-cases";
import type { LegalDocumentSlug } from "@/domain/legal/legal-document";
import { LEGAL_LIMITS, nextLegalVersion, type LegalDocumentDraft, type LegalLibrary, type LegalPublishInput } from "@/domain/legal/legal-editing";
import { Button } from "@/ui/components/Button";
import { FormSection } from "../../components/AdminUi";
import { FormFooter } from "../../components/FormFooter";
import { useMutation } from "../../hooks";
import { useToast } from "../../toast";
import { CopyField, type FieldErrors } from "../fields";
import { ControllerFields } from "./ControllerFields";
import { buildPublishInput, changesOf, initialDraft, OTHER_SLUG, type LegalDraftState } from "./legal-draft";
import { LegalPreview } from "./LegalPreview";
import { LegalSectionsField } from "./LegalSectionsField";

const DOCUMENT_NAME: Record<LegalDocumentSlug, string> = { terms: "Termos de uso", privacy: "Política de privacidade" };

function publishSummary(slug: LegalDocumentSlug, library: LegalLibrary, changes: { document: boolean; controller: boolean }): string {
  if (!changes.document && !changes.controller) return "Nada mudou ainda.";
  const own = `${DOCUMENT_NAME[slug]} ${library[slug].document.version} → ${nextLegalVersion(library[slug].document.version)}`;
  if (!changes.controller) return `Publica ${own}.`;
  const other = OTHER_SLUG[slug];
  return `Publica ${own} e ${DOCUMENT_NAME[other]} ${library[other].document.version} → ${nextLegalVersion(library[other].document.version)}, porque os dados da empresa aparecem nos dois.`;
}

interface LegalEditorProps {
  slug: LegalDocumentSlug;
  library: LegalLibrary;
  /** Recarrega do banco; a chave do editor remonta o formulário com a versão nova. */
  reload: () => void;
}

/** Site > Termos de uso / Política de privacidade: o Jota edita o texto e publica uma versão nova. */
export function LegalEditor({ slug, library, reload }: LegalEditorProps) {
  const toast = useToast();
  const [draft, setDraft] = useState<LegalDraftState>(() => initialDraft(library, slug));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [previewing, setPreviewing] = useState(false);
  const changes = useMemo(() => changesOf(library, slug, draft), [library, slug, draft]);
  const changed = changes.document || changes.controller;

  const publish = useMutation(async (deps, input: LegalPublishInput) => {
    await publishLegalDocuments(deps, input);
    return true;
  });

  const updateDocument = (patch: Partial<LegalDocumentDraft>) => setDraft((current) => ({ ...current, document: { ...current.document, ...patch } }));

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!changed) {
      toast.show("Nada mudou: não há versão nova para publicar.");
      return;
    }
    const { input, errors: found } = buildPublishInput(library, slug, draft);
    setErrors(found);
    if (!input) {
      toast.show("Confira os campos destacados.");
      return;
    }
    if (!(await publish.run(input))) return;
    toast.show("Versão nova publicada. Quem comprar a partir de agora aceita este texto.");
    reload();
  };

  return (
    <form noValidate onSubmit={onSubmit} aria-busy={publish.pending} className="grid grid-cols-1 gap-6">
      <p className="max-w-3xl text-sm text-mist">
        Versão no ar: <strong className="font-semibold text-fog">{library[slug].document.version}</strong>. Cada publicação vira uma versão
        nova com a data de hoje. Quem já comprou continua com a prova da versão que aceitou.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setPreviewing((open) => !open)} aria-expanded={previewing}>
          {previewing ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          {previewing ? "Fechar a prévia" : "Ver como fica no site"}
        </Button>
      </div>
      {previewing && <LegalPreview slug={slug} library={library} draft={draft} />}

      <FormSection title="Começo da página" description="O título e o resumo que aparecem antes das seções.">
        <CopyField label="Título" path="title" value={draft.document.title} max={LEGAL_LIMITS.title} errors={errors} onChange={(title) => updateDocument({ title })} />
        <CopyField
          label="Resumo"
          path="summary"
          value={draft.document.summary}
          max={LEGAL_LIMITS.summary}
          multiline
          errors={errors}
          onChange={(summary) => updateDocument({ summary })}
        />
      </FormSection>

      <FormSection title="Seções" description="Arraste para mudar a ordem. Cada seção vira um item do índice no começo da página.">
        <LegalSectionsField sections={draft.document.sections} errors={errors} onChange={(sections) => updateDocument({ sections })} />
      </FormSection>

      <ControllerFields value={draft.controller} errors={errors} onChange={(controller) => setDraft((current) => ({ ...current, controller }))} />

      <FormSection title="Publicar" description="Escreva o que mudou: aparece no histórico de versões, no fim da página.">
        <CopyField
          label="O que mudou nesta versão"
          path="note"
          value={draft.note}
          max={LEGAL_LIMITS.note}
          multiline
          errors={errors}
          onChange={(note) => setDraft((current) => ({ ...current, note }))}
        />
        <p className="text-sm text-fog" aria-live="polite">
          {publishSummary(slug, library, changes)}
        </p>
      </FormSection>

      <FormFooter
        submitLabel="Publicar versão nova"
        mobileSubmitLabel="Publicar"
        pendingLabel="Publicando…"
        submitIcon={<Send aria-hidden className="size-4" />}
        pending={publish.pending}
        errors={[errors.form, publish.error?.message]}
      />
    </form>
  );
}
