import { ExternalLink, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Account } from "@/domain/account";
import { SiteContentProvider, useSiteContent } from "@/ui/hooks/useSiteContent";
import { StoreSettingsProvider } from "@/ui/hooks/useStoreSettings";
import { automaticDescriptionOf } from "@/ui/lib/account-presenter";
import { AccountIncluded } from "@/ui/sections/account/AccountDetails";
import { AccountSpecsField } from "./AccountSpecsField";
import { FormSection } from "../components/AdminUi";
import { TextAreaField } from "../components/FormControls";
import { previewAccountOf, type AccountFormErrors, type AccountFormValues } from "../forms/account-form";

interface AccountPageSectionProps {
  values: AccountFormValues;
  errors: AccountFormErrors;
  set: <K extends keyof AccountFormValues>(field: K, value: AccountFormValues[K]) => void;
  accountId: string;
}

const SiteTabLink = () => (
  <Link to="/admin/site" className="inline-flex items-center gap-1 text-electric-soft underline-offset-4 hover:underline">
    Site, em Página da conta <ExternalLink aria-hidden className="size-3" />
  </Link>
);

/**
 * "Sobre esta conta": começa mostrando o texto automático, que acompanha os números. Ao mexer, o campo vira do Jota
 * e fica como ele deixar, inclusive vazio para escrever do zero; em branco, o site volta a usar o automático.
 */
function AboutField({ values, errors, set, automatic }: Omit<AccountPageSectionProps, "accountId"> & { automatic: string | null }) {
  const written = values.description.trim() !== "";
  const [editing, setEditing] = useState(written);
  const shown = editing || !automatic ? values.description : automatic;
  const onChange = (text: string) => {
    setEditing(true);
    set("description", text);
  };
  const backToAutomatic = () => {
    setEditing(false);
    set("description", "");
  };
  const hint = written
    ? "Texto escrito por você. Deixe uma linha em branco entre os parágrafos."
    : editing
      ? "Em branco, o site mostra o texto automático. Escreva o seu; linha em branco separa parágrafos."
      : "Texto automático: acompanha os números da conta. Edite à vontade ou apague tudo para escrever do zero.";
  return (
    <div>
      <TextAreaField
        label="Sobre esta conta"
        name="description"
        rows={6}
        maxLength={2000}
        value={shown}
        placeholder={automatic ?? undefined}
        onChange={(event) => onChange(event.target.value)}
        error={errors.description}
        hint={hint}
      />
      {editing && automatic && (
        <button
          type="button"
          onClick={backToAutomatic}
          className="mt-2 inline-flex items-center gap-1.5 rounded-lg text-xs text-mist hover:text-white focus-visible:outline-2 focus-visible:outline-electric"
        >
          <RotateCcw aria-hidden className="size-3.5" /> Voltar ao texto automático
        </button>
      )}
    </div>
  );
}

function NicheNote({ account }: { account: Account }) {
  const { accountPage } = useSiteContent();
  if (!account.niche || !accountPage.nicheNote) return null;
  return (
    <p className="rounded-xl border border-line bg-ink/60 p-3 text-sm text-mist">
      <span className="block text-xs font-semibold text-fog">Aviso abaixo do texto (igual em toda conta com nicho)</span>
      {accountPage.nicheNote}
    </p>
  );
}

function ReadOnlyBlock({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-ink/40 p-4">
      <div className="pointer-events-none">{children}</div>
      <p className="mt-4 text-xs leading-relaxed text-mist">{caption}</p>
    </div>
  );
}

/** Tudo o que a página da conta mostra além do topo: o que é desta conta se edita aqui; o que é fixo, na aba Site. */
export function AccountPageSection({ values, errors, set, accountId }: AccountPageSectionProps) {
  const preview = previewAccountOf(values, accountId);
  const automatic = preview ? automaticDescriptionOf({ ...preview, description: null }) : null;
  return (
    <StoreSettingsProvider>
      <SiteContentProvider>
        <FormSection
          title="Página da conta"
          description="O que aparece na página desta conta no site. O texto e a ficha técnica você edita aqui; as partes iguais em toda conta ficam na aba Site."
        >
          <AboutField values={values} errors={errors} set={set} automatic={automatic} />
          {preview && <NicheNote account={preview} />}
          <AccountSpecsField specs={values.specs} preview={preview} errors={errors} onChange={(specs) => set("specs", specs)} />
          {preview ? (
            <>
              <ReadOnlyBlock
                caption={
                  <>
                    Monetização e conta profissional entram sozinhas, pelos campos acima. Os outros itens são os de cada rede, em <SiteTabLink />.
                  </>
                }
              >
                <AccountIncluded account={preview} />
              </ReadOnlyBlock>
            </>
          ) : (
            <p className="text-sm text-mist">Preencha os dados da conta para ver o que está incluso.</p>
          )}
        </FormSection>
      </SiteContentProvider>
    </StoreSettingsProvider>
  );
}
