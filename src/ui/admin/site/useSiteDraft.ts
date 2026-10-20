import { useCallback, useMemo, useState } from "react";
import { saveSiteContent } from "@/application/admin-use-cases";
import { fieldErrorsOf, siteContentSchema } from "@/application/schemas";
import { DEFAULT_SITE_CONTENT, type SiteContent, type SiteSectionKey } from "@/domain/site-content";
import { useMutation } from "../hooks";

const sameContent = (a: SiteContent, b: SiteContent) => JSON.stringify(a) === JSON.stringify(b);

/** Erros do rascunho por caminho ("hero.title", "faq.items.2.answer"). */
function errorsOf(draft: SiteContent): Record<string, string> {
  const result = siteContentSchema.safeParse(draft);
  return result.success ? {} : fieldErrorsOf(result.error);
}

/**
 * Rascunho dos textos do site: nada vai para o ar até salvar.
 * Os erros aparecem depois da primeira tentativa de salvar, para não brigar com quem ainda está digitando.
 */
export function useSiteDraft(initial: SiteContent) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(initial);
  const [showErrors, setShowErrors] = useState(false);
  const { run: runSave, reset: resetSave, pending, error: saveError } = useMutation(saveSiteContent);

  const errors = useMemo(() => (showErrors ? errorsOf(draft) : {}), [draft, showErrors]);
  const dirty = !sameContent(draft, saved);

  const setSection = useCallback(<K extends SiteSectionKey>(key: K, value: SiteContent[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  }, []);

  const resetSection = useCallback((key: SiteSectionKey) => {
    setDraft((current) => ({ ...current, [key]: structuredClone(DEFAULT_SITE_CONTENT[key]) }));
  }, []);

  const discard = useCallback(() => {
    setDraft(saved);
    setShowErrors(false);
    resetSave();
  }, [saved, resetSave]);

  /** Devolve a seção do primeiro erro (para abrir o painel certo) ou nulo quando salvou. */
  const publish = useCallback(async (): Promise<{ ok: true } | { ok: false; section: SiteSectionKey | null }> => {
    const found = errorsOf(draft);
    const firstPath = Object.keys(found)[0];
    if (firstPath) {
      setShowErrors(true);
      return { ok: false, section: (firstPath.split(".")[0] as SiteSectionKey | undefined) ?? null };
    }
    const published = await runSave(draft);
    if (!published) return { ok: false, section: null };
    setSaved(published);
    setDraft(published);
    setShowErrors(false);
    return { ok: true };
  }, [draft, runSave]);

  const sectionHasErrors = useCallback(
    (key: SiteSectionKey) => Object.keys(errors).some((path) => path === key || path.startsWith(`${key}.`)),
    [errors],
  );

  return {
    draft,
    errors,
    dirty,
    pending,
    saveError,
    setSection,
    resetSection,
    discard,
    publish,
    sectionHasErrors,
  };
}

export type SiteDraft = ReturnType<typeof useSiteDraft>;
