import { useSearchParams } from "react-router-dom";
import { getLegalLibrary, getSiteContent } from "@/application/admin-use-cases";
import type { LegalDocumentSlug } from "@/domain/legal/legal-document";
import { ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { useAdminQuery } from "../hooks";
import { ContactSettings } from "../site/ContactSettings";
import { LegalEditor } from "../site/legal/LegalEditor";
import { SITE_SECTIONS } from "../site/section-forms";
import { SiteEditor } from "../site/SiteEditor";

type SiteTab = "textos" | "contato" | "sobre" | "termos" | "privacidade";

const SITE_TABS: readonly SiteTab[] = ["textos", "contato", "sobre", "termos", "privacidade"];

/** Quem sou eu tem aba própria, mas é o mesmo rascunho dos textos: publicar numa leva tudo junto. */
const ABOUT_SECTIONS = SITE_SECTIONS.filter((section) => section.key === "aboutPage");
const TEXT_SECTIONS = SITE_SECTIONS.filter((section) => section.key !== "aboutPage");

const LEGAL_TABS: readonly { tab: SiteTab; slug: LegalDocumentSlug }[] = [
  { tab: "termos", slug: "terms" },
  { tab: "privacidade", slug: "privacy" },
];

const isSiteTab = (value: string | null): value is SiteTab => SITE_TABS.includes(value as SiteTab);

const TAB_PARAM = "aba";

function TextsTab({ about }: { about: boolean }) {
  const content = useAdminQuery(getSiteContent, "site-content");
  if (content.status === "loading") return <LoadingBlock />;
  if (content.status === "error") return <ErrorState message={content.error.message} onRetry={content.reload} />;
  return <SiteEditor initial={content.data} sections={about ? ABOUT_SECTIONS : TEXT_SECTIONS} />;
}

/** Termos e Política carregam juntos: mudar os dados da empresa num publica versão nova dos dois. */
function LegalTabs({ tab }: { tab: SiteTab }) {
  const library = useAdminQuery(getLegalLibrary, "legal-library");
  const open = LEGAL_TABS.some((legal) => legal.tab === tab);
  if (library.status === "loading") return open ? <LoadingBlock /> : null;
  if (library.status === "error") return open ? <ErrorState message={library.error.message} onRetry={library.reload} /> : null;
  const { data } = library;
  return (
    <>
      {/* A chave remonta o editor com o texto publicado; trocar de aba não apaga o rascunho. */}
      {LEGAL_TABS.map((legal) => (
        <div key={legal.tab} hidden={tab !== legal.tab}>
          <LegalEditor key={`${data.terms.document.version}|${data.privacy.document.version}`} slug={legal.slug} library={data} reload={library.reload} />
        </div>
      ))}
    </>
  );
}

export default function SitePage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get(TAB_PARAM);
  const tab: SiteTab = isSiteTab(requested) ? requested : "textos";

  const setTab = (next: SiteTab) => {
    const nextParams = new URLSearchParams(params);
    if (next === "textos") nextParams.delete(TAB_PARAM);
    else nextParams.set(TAB_PARAM, next);
    setParams(nextParams, { replace: true });
  };

  return (
    <>
      <PageHeader title="Site" description="Tudo que aparece no site: textos, imagens, contato, garantia, quem sou eu, termos de uso e política de privacidade. Você vê a mudança antes de publicar." />
      <div className="mt-5 mb-6">
        <FilterChips<SiteTab>
          label="Parte do site"
          value={tab}
          onChange={setTab}
          options={[
            { value: "textos", label: "Textos e imagens" },
            { value: "contato", label: "Contato e garantia" },
            { value: "sobre", label: "Quem sou eu" },
            { value: "termos", label: "Termos de uso" },
            { value: "privacidade", label: "Política de privacidade" },
          ]}
        />
      </div>
      {/* As abas ficam montadas: trocar de aba não apaga o rascunho. */}
      <div hidden={tab !== "textos" && tab !== "sobre"}>
        <TextsTab about={tab === "sobre"} />
      </div>
      <div hidden={tab !== "contato"}>
        <ContactSettings />
      </div>
      <LegalTabs tab={tab} />
    </>
  );
}
