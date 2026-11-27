import { Check, Megaphone, Store } from "lucide-react";
import { useState } from "react";
import { getSiteContent, saveSiteContent } from "@/application/admin-use-cases";
import { siteConfig } from "@/app/config";
import type { SiteContent } from "@/domain/site-content";
import { STOCK_CATEGORIES, STOCK_CATEGORY_LABEL, type StockCategory } from "@/domain/stock";
import { isStorefrontClosed } from "@/domain/storefront";
import { Button } from "@/ui/components/Button";
import { TextField } from "@/ui/components/form/Fields";
import { cn } from "@/ui/lib/cn";
import { TextAreaField, ToggleField } from "../components/FormControls";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const CATALOG_URL = `${siteConfig.url}/contas`;

type CatalogPage = SiteContent["catalogPage"];

/** Mensagem pronta para a comunidade: o WhatsApp abre o seletor de conversa (grupo não aceita envio por sistema). */
function communityPostUrl(content: SiteContent): string {
  const text = content.catalogPage.reopenMessage.replaceAll("{link}", CATALOG_URL);
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

function toggledCategories(hidden: readonly StockCategory[], category: StockCategory): StockCategory[] {
  return hidden.includes(category) ? hidden.filter((item) => item !== category) : [...hidden, category];
}

interface ClosedNoticeEditorProps {
  page: CatalogPage;
  saving: boolean;
  onSave: (patch: Pick<CatalogPage, "closedTitle" | "closedMessage">) => void;
}

/** O aviso que o site mostra no lugar das contas: o Jota edita aqui mesmo, sem procurar na aba Site. */
function ClosedNoticeEditor({ page, saving, onSave }: ClosedNoticeEditorProps) {
  const [title, setTitle] = useState(page.closedTitle);
  const [message, setMessage] = useState(page.closedMessage);
  const changed = title !== page.closedTitle || message !== page.closedMessage;
  const valid = title.trim().length > 0 && message.trim().length > 0;
  return (
    <details className="group rounded-xl border border-line-strong bg-ink px-4 py-3">
      <summary className="cursor-pointer text-sm font-medium text-white">Editar o aviso de fora de estoque</summary>
      <div className="mt-3 space-y-3">
        <TextField label="Título" value={title} maxLength={90} onChange={(event) => setTitle(event.target.value)} />
        <TextAreaField label="Texto" value={message} maxLength={400} rows={4} onChange={(event) => setMessage(event.target.value)} />
        <Button
          type="button"
          className="w-full sm:w-auto"
          disabled={!changed || !valid || saving}
          onClick={() => onSave({ closedTitle: title.trim(), closedMessage: message.trim() })}
        >
          Salvar o aviso
        </Button>
      </div>
    </details>
  );
}

/**
 * Chamados do Jota: desligar a vitrine entre uma remessa e outra (ou só alguns tipos de estoque), avisar a comunidade
 * quando voltar e ligar ou desligar a lista de espera ("Me avise").
 */
export function StorefrontSwitch() {
  const content = useAdminQuery(getSiteContent, "site-content:storefront");
  const save = useMutation(saveSiteContent);
  const toast = useToast();

  if (content.status !== "success") return null;
  const page = content.data.catalogPage;
  const closed = isStorefrontClosed(page);

  const update = async (patch: Partial<CatalogPage>, message: string) => {
    const saved = await save.run({ ...content.data, catalogPage: { ...page, ...patch } });
    if (!saved) {
      toast.show("Não deu para salvar. Tente de novo.", "error");
      return;
    }
    content.reload();
    toast.show(message);
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
              <strong className="text-white">Vitrine desligada.</strong> Nenhuma conta aparece no site; o cliente vê “{page.closedTitle}”.
            </>
          ) : page.hiddenCategories.length > 0 ? (
            <>
              <strong className="text-white">Vitrine ligada em parte.</strong> Fora do site:{" "}
              {page.hiddenCategories.map((category) => STOCK_CATEGORY_LABEL[category]).join(", ")}.
            </>
          ) : (
            <>
              <strong className="text-white">Vitrine ligada.</strong> As contas disponíveis aparecem no site.
            </>
          )}
        </p>
      </div>
      <ToggleField
        label="Mostrar as contas no site"
        description="Desligue quando acabar o estoque ou antes de lançar uma remessa nova."
        checked={!page.closed}
        onChange={(open) =>
          void update({ closed: !open }, open ? "Vitrine ligada: as contas já aparecem no site." : "Vitrine desligada: o site mostra o aviso de estoque.")
        }
      />
      {!page.closed && (
        <fieldset>
          <legend className="text-xs font-semibold text-mist">Tipos na vitrine (toque para tirar ou voltar)</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {STOCK_CATEGORIES.map((category) => {
              const shown = !page.hiddenCategories.includes(category);
              return (
                <button
                  key={category}
                  type="button"
                  aria-pressed={shown}
                  disabled={save.pending}
                  onClick={() =>
                    void update(
                      { hiddenCategories: toggledCategories(page.hiddenCategories, category) },
                      `${STOCK_CATEGORY_LABEL[category]}: ${shown ? "fora da vitrine" : "de volta na vitrine"}.`,
                    )
                  }
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors disabled:opacity-60",
                    shown ? "border-electric/40 bg-electric/10 text-white" : "border-line-strong text-mist line-through",
                  )}
                >
                  {shown && <Check aria-hidden className="size-3.5 text-electric" />}
                  {STOCK_CATEGORY_LABEL[category]}
                </button>
              );
            })}
          </div>
        </fieldset>
      )}
      <ClosedNoticeEditor page={page} saving={save.pending} onSave={(patch) => void update(patch, "Aviso de fora de estoque salvo.")} />
      <ToggleField
        label="Lista de espera (“Me avise quando chegar”)"
        description="Desligada, os botões de “Me avise” somem do site. Os cadastros que já existem continuam em Lista de espera."
        checked={page.waitlist}
        onChange={(waitlist) => void update({ waitlist }, waitlist ? "Lista de espera ligada no site." : "Lista de espera fora do site.")}
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
