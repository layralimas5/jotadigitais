import { ExternalLink, RotateCcw } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import type { Account } from "@/domain/account";
import { DESCRIPTION_KIND_LABEL, descriptionKindOf, type DescriptionTemplates } from "@/domain/account-description";
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

interface AutomaticText {
  text: string;
  /** Nome do tipo de conta quando o texto vem do modelo dele na aba Site; null quando é o montado pelo sistema. */
  templateLabel: string | null;
}

function automaticTextOf(account: Account | null, templates: DescriptionTemplates): AutomaticText | null {
  if (!account) return null;
  const kind = descriptionKindOf(account);
  return {
    text: automaticDescriptionOf({ ...account, description: null }, templates),
    templateLabel: templates[kind].trim() ? DESCRIPTION_KIND_LABEL[kind] : null,
  };
}

/**
 * "Sobre esta conta": começa mostrando o texto automático (o modelo do tipo de conta, ou o montado pelo sistema).
 * Ao mexer, o campo vira do Jota e fica como ele deixar; em branco, o site volta a usar o automático.
 */
function AboutField({ values, errors, set, automatic: auto }: Omit<AccountPageSectionProps, "accountId"> & { automatic: AutomaticText | null }) {
  const automatic = auto?.text ?? null;
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
      : auto?.templateLabel
        ? `Texto do modelo "${auto.templateLabel}", em Site > Página da conta. Edite à vontade só nesta conta ou mude o modelo para todas.`
        : "Texto automático: acompanha os números da conta. Para fixar um texto por tipo de conta, use os modelos em Site > Página da conta.";
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
          <RotateCcw aria-hidden className="size-3.5" /> {auto?.templateLabel ? "Voltar ao modelo do tipo de conta" : "Voltar ao texto automático"}
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
export function AccountPageSection(props: AccountPageSectionProps) {
  return (
    <StoreSettingsProvider>
      <SiteContentProvider>
        <AccountPageBody {...props} />
      </SiteContentProvider>
    </StoreSettingsProvider>
  );
}

function AccountPageBody({ values, errors, set, accountId }: AccountPageSectionProps) {
  const { accountPage } = useSiteContent();
  const preview = previewAccountOf(values, accountId);
  const automatic = automaticTextOf(preview, accountPage.descriptionTemplates);
  return (
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
  );
}
