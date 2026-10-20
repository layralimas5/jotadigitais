import { useSearchParams } from "react-router-dom";
import { getSiteContent } from "@/application/admin-use-cases";
import { ErrorState } from "@/ui/components/StateViews";
import { LoadingBlock, PageHeader } from "../components/AdminUi";
import { FilterChips } from "../components/FilterChips";
import { useAdminQuery } from "../hooks";
import { ContactSettings } from "../site/ContactSettings";
import { SiteEditor } from "../site/SiteEditor";

type SiteTab = "textos" | "contato";

const TAB_PARAM = "aba";

function TextsTab() {
  const content = useAdminQuery(getSiteContent, "site-content");
  if (content.status === "loading") return <LoadingBlock />;
  if (content.status === "error") return <ErrorState message={content.error.message} onRetry={content.reload} />;
  return <SiteEditor initial={content.data} />;
}

export default function SitePage() {
  const [params, setParams] = useSearchParams();
  const tab: SiteTab = params.get(TAB_PARAM) === "contato" ? "contato" : "textos";

  const setTab = (next: SiteTab) => {
    const nextParams = new URLSearchParams(params);
    if (next === "textos") nextParams.delete(TAB_PARAM);
    else nextParams.set(TAB_PARAM, next);
    setParams(nextParams, { replace: true });
  };

  return (
    <>
      <PageHeader title="Site" description="Tudo que aparece no site: textos, imagens, contato e garantia. Você vê a mudança antes de publicar." />
      <div className="mt-5 mb-6">
        <FilterChips<SiteTab>
          label="Parte do site"
          value={tab}
          onChange={setTab}
          options={[
            { value: "textos", label: "Textos e imagens" },
            { value: "contato", label: "Contato e garantia" },
          ]}
        />
      </div>
      {/* As duas abas ficam montadas: trocar de aba não apaga o rascunho dos textos. */}
      <div hidden={tab !== "textos"}>
        <TextsTab />
      </div>
      <div hidden={tab !== "contato"}>
        <ContactSettings />
      </div>
    </>
  );
}
