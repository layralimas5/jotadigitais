import { Megaphone, Store } from "lucide-react";
import { Link } from "react-router-dom";
import { getSiteContent, saveSiteContent } from "@/application/admin-use-cases";
import { siteConfig } from "@/app/config";
import type { SiteContent } from "@/domain/site-content";
import { cn } from "@/ui/lib/cn";
import { ToggleField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const CATALOG_URL = `${siteConfig.url}/contas`;

/** Mensagem pronta para a comunidade: o WhatsApp abre o seletor de conversa (grupo não aceita envio por sistema). */
function communityPostUrl(content: SiteContent): string {
  const text = content.catalogPage.reopenMessage.replaceAll("{link}", CATALOG_URL);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

const withClosed = (content: SiteContent, closed: boolean): SiteContent => ({
  ...content,
  catalogPage: { ...content.catalogPage, closed },
});

/**
 * Chamado do Jota: desligar a vitrine entre uma remessa e outra (nenhuma conta aparece no site, só o aviso)
 * e, ao religar, postar na comunidade que chegou remessa nova.
 */
export function StorefrontSwitch() {
  const content = useAdminQuery(getSiteContent, "site-content:storefront");
  const save = useMutation(saveSiteContent);
  const toast = useToast();

  if (content.status !== "success") return null;
  const closed = content.data.catalogPage.closed;

  const toggle = async (open: boolean) => {
    const saved = await save.run(withClosed(content.data, !open));
    if (!saved) {
      toast.show("Não deu para mudar a vitrine. Tente de novo.", "error");
      return;
    }
    content.reload();
    toast.show(open ? "Vitrine ligada: as contas já aparecem no site." : "Vitrine desligada: o site mostra o aviso de estoque.");
  };

  return (
    <section
      aria-label="Vitrine do site"
      className={cn("space-y-3 rounded-2xl border p-4", closed ? "border-pink/40 bg-pink/[0.06]" : "border-line-strong bg-surface")}
    >
      <div className="flex items-start gap-3">
        <Store aria-hidden className={cn("mt-0.5 size-5 shrink-0", closed ? "text-pink" : "text-emerald-300")} />
        <p className="text-sm text-fog">
          {closed ? (
            <>
              <strong className="text-white">Vitrine desligada.</strong> Nenhuma conta aparece no site; o cliente vê “
              {content.data.catalogPage.closedTitle}”.
            </>
          ) : (
            <>
              <strong className="text-white">Vitrine ligada.</strong> As contas disponíveis aparecem no site.
            </>
          )}{" "}
          <Link to="/admin/site" className="text-electric underline-offset-4 hover:underline">
            Editar o aviso
          </Link>
        </p>
      </div>
      <ToggleField
        label="Mostrar as contas no site"
        description="Desligue quando acabar o estoque ou antes de lançar uma remessa nova."
        checked={!closed}
        onChange={(open) => void toggle(open)}
      />
      {!closed && (
        <a
          href={communityPostUrl(content.data)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm font-medium text-electric underline-offset-4 hover:underline"
        >
          <Megaphone aria-hidden className="size-4" /> Avisar a comunidade que chegou remessa nova
        </a>
      )}
    </section>
  );
}
