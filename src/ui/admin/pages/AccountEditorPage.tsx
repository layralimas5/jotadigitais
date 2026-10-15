import { ArrowLeft, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteAccount, findAccount, saveAccount } from "@/application/admin-use-cases";
import { ACCOUNT_STATUSES, type Account, type AccountData, type AccountStatus } from "@/domain/account";
import { ACCOUNT_STATUS_LABEL } from "@/ui/lib/account-presenter";
import { AUDIENCE_LABEL, PLATFORMS, PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { Button } from "@/ui/components/Button";
import { AccountCard } from "@/ui/components/account/AccountCard";
import { TextField } from "@/ui/components/form/Fields";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, InlineError, LoadingBlock, MobileActionBar, PageHeader } from "../components/AdminUi";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, SelectField, TextAreaField, ToggleField } from "../components/FormControls";
import { AvatarField, GalleryField } from "../components/ImageUpload";
import {
  ACCOUNT_FIELD_ORDER,
  emptyAccountForm,
  fromAccount,
  useAccountForm,
  validateAccountForm,
  type AccountFormErrors,
  type AccountFormValues,
} from "../forms/account-form";
import { useAdminQuery, useMutation } from "../hooks";
import { useToast } from "../toast";

const STATUS_OPTIONS = ACCOUNT_STATUSES.map((value) => ({ value, label: ACCOUNT_STATUS_LABEL[value] }));
const PLATFORM_OPTIONS = PLATFORMS.map((value) => ({
  value,
  label: PLATFORM_LABEL[value],
  icon: <PlatformGlyph platform={value} className="size-4" />,
}));
const MAX_IMAGES = 8;

type SetField = <K extends keyof AccountFormValues>(field: K, value: AccountFormValues[K]) => void;

interface FieldsProps {
  values: AccountFormValues;
  errors: AccountFormErrors;
  set: SetField;
}

function NumberInput({ label, name, value, error, hint, onChange }: { label: string; name: string; value: string; error?: string; hint?: string; onChange: (value: string) => void }) {
  return (
    <TextField
      label={label}
      name={name}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      hint={hint}
    />
  );
}

/** Os números que importam em cada rede. */
function PlatformStatsFields({ values, errors, set }: FieldsProps) {
  const followers = (
    <NumberInput
      label={AUDIENCE_LABEL[values.platform]}
      name="followers"
      value={values.followers}
      error={errors.followers}
      onChange={(value) => set("followers", value)}
    />
  );

  switch (values.platform) {
    case "tiktok":
      return (
        <div className="grid gap-4 sm:grid-cols-3">
          {followers}
          <NumberInput label="Curtidas" name="stats.likes" value={values.likes} error={errors["stats.likes"]} onChange={(value) => set("likes", value)} />
          <NumberInput label="Seguindo" name="stats.following" value={values.following} error={errors["stats.following"]} onChange={(value) => set("following", value)} />
        </div>
      );
    case "instagram":
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {followers}
            <NumberInput label="Publicações" name="stats.posts" value={values.posts} error={errors["stats.posts"]} onChange={(value) => set("posts", value)} />
            <NumberInput label="Seguindo" name="stats.following" value={values.following} error={errors["stats.following"]} onChange={(value) => set("following", value)} />
          </div>
          <ToggleField
            label="Conta profissional"
            description="Criador ou comercial, com painel de estatísticas."
            checked={values.professional}
            onChange={(checked) => set("professional", checked)}
          />
        </>
      );
    case "youtube":
      return (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {followers}
            <NumberInput label="Visualizações totais" name="stats.views" value={values.views} error={errors["stats.views"]} onChange={(value) => set("views", value)} />
            <NumberInput label="Vídeos publicados" name="stats.videos" value={values.videos} error={errors["stats.videos"]} onChange={(value) => set("videos", value)} />
            <NumberInput
              label="Horas de exibição (12 meses)"
              name="stats.watchHours"
              value={values.watchHours}
              error={errors["stats.watchHours"]}
              hint="Está no YouTube Studio, em Monetização."
              onChange={(value) => set("watchHours", value)}
            />
          </div>
          <ToggleField
            label="Canal monetizado"
            description="Já está no Programa de Parcerias do YouTube."
            checked={values.monetized}
            onChange={(checked) => set("monetized", checked)}
          />
        </>
      );
    case "facebook":
      return (
        <>
          <SegmentedField
            legend="Tipo"
            name="facebookKind"
            value={values.facebookKind}
            options={[
              { value: "page", label: "Página" },
              { value: "profile", label: "Perfil" },
            ]}
            onChange={(value) => set("facebookKind", value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            {followers}
            <NumberInput label="Curtidas" name="stats.likes" value={values.likes} error={errors["stats.likes"]} onChange={(value) => set("likes", value)} />
          </div>
          <ToggleField
            label="Monetização ativa"
            description="A conta já recebe pelo Facebook."
            checked={values.monetized}
            onChange={(checked) => set("monetized", checked)}
          />
        </>
      );
  }
}

function LivePreview({ values, accountId }: { values: AccountFormValues; accountId: string }) {
  const result = validateAccountForm(values);
  if (!result.data) {
    return (
      <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
        Preencha os campos obrigatórios para ver como a conta aparece na vitrine.
      </p>
    );
  }
  const preview: Account = { ...result.data, id: accountId, reservedUntil: null };
  return (
    <div className="pointer-events-none" aria-label="Prévia do card na vitrine">
      <AccountCard account={preview} />
    </div>
  );
}

function focusFirstError(form: HTMLFormElement, errors: AccountFormErrors) {
  const first = ACCOUNT_FIELD_ORDER.find((field) => errors[field]);
  if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
}

function AccountEditor({ account }: { account: Account | null }) {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useAccountForm(account ? fromAccount(account) : emptyAccountForm());
  const { values, errors, set } = form;
  const save = useMutation((deps, data: AccountData) => saveAccount(deps, account?.id ?? null, data));
  const remove = useMutation(async (deps, id: string) => {
    await deleteAccount(deps, id);
    return true;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const result = form.validate();
    if (!result.data) {
      focusFirstError(formElement, result.errors);
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(result.data);
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    toast.show(`Conta ${saved.handle} salva. Já aparece no site.`);
    navigate("/admin/contas");
  };

  const onDelete = async () => {
    if (!account) return;
    const removed = await remove.run(account.id);
    if (!removed) return;
    toast.show(`Conta ${account.handle} apagada.`);
    navigate("/admin/contas");
  };

  return (
    <>
      <Link to="/admin/contas" className="inline-flex items-center gap-2 text-sm text-mist hover:text-white">
        <ArrowLeft aria-hidden className="size-4" /> Voltar para as contas
      </Link>
      <div className="mt-4">
        <PageHeader
          title={account ? `Editar ${account.displayName}` : "Nova conta"}
          description="Os dados aparecem na vitrine assim que você salvar."
        />
      </div>

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-5">
          <FormSection title="Rede social">
            <SegmentedField<Platform>
              legend="Em qual rede é a conta?"
              name="platform"
              value={values.platform}
              options={PLATFORM_OPTIONS}
              onChange={(value) => set("platform", value)}
              columns={4}
            />
            <AvatarField
              label="Foto de perfil"
              hint={`Use a mesma foto do perfil no ${PLATFORM_LABEL[values.platform]}. Aparece na vitrine e na página da conta.`}
              value={values.avatarUrl}
              onChange={(url) => set("avatarUrl", url)}
              error={errors.avatarUrl}
            />
          </FormSection>

          <FormSection title="Perfil">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nome do perfil" name="displayName" value={values.displayName} onChange={(event) => set("displayName", event.target.value)} error={errors.displayName} />
              <TextField
                label="@ da conta"
                name="handle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                placeholder="@exemplo"
                value={values.handle}
                onChange={(event) => set("handle", event.target.value)}
                error={errors.handle}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Endereço da página"
                name="slug"
                autoCapitalize="none"
                spellCheck={false}
                value={values.slug}
                onChange={(event) => set("slug", event.target.value.toLowerCase())}
                error={errors.slug}
                hint={values.slug ? `site/contas/${values.slug}` : "Gerado a partir do nome."}
              />
              <TextField label="Nicho (opcional)" name="niche" placeholder="Ex.: Moda, Humor" value={values.niche} onChange={(event) => set("niche", event.target.value)} error={errors.niche} />
            </div>
          </FormSection>

          <FormSection title="Números da conta" description="Copie direto do perfil no dia do anúncio.">
            <PlatformStatsFields values={values} errors={errors} set={set} />
          </FormSection>

          <FormSection title="Venda">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Preço (R$)" name="price" inputMode="decimal" placeholder="370,00" value={values.price} onChange={(event) => set("price", event.target.value)} error={errors.price} />
              <SelectField label="Status" name="status" value={values.status} options={STATUS_OPTIONS} onChange={(event) => set("status", event.target.value as AccountStatus)} />
              <TextField label="Anunciada em" name="listedAt" type="date" value={values.listedAt} onChange={(event) => set("listedAt", event.target.value)} error={errors.listedAt} />
            </div>
            <TextAreaField
              label="Descrição (opcional)"
              name="description"
              value={values.description}
              onChange={(event) => set("description", event.target.value)}
              error={errors.description}
              hint="Se ficar vazio, o site monta um texto com os números da conta."
              maxLength={2000}
            />
          </FormSection>

          <FormSection title="Prints da conta (opcional)" description="Aparecem na galeria da página da conta. Desfoque dados pessoais antes de enviar.">
            <GalleryField
              label="Imagens"
              folder="accounts"
              images={values.images}
              max={MAX_IMAGES}
              onChange={(images) => set("images", images)}
              error={errors.images}
              hint={`Até ${MAX_IMAGES} prints. São reduzidos e convertidos automaticamente.`}
            />
          </FormSection>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <p className="text-sm font-medium text-fog">Prévia na vitrine</p>
          <LivePreview values={values} accountId={account?.id ?? "preview"} />
          {Object.keys(errors).length > 0 && <InlineError message="Revise os campos marcados em vermelho." />}
          {save.error && <InlineError message={save.error.message} />}
          <Button type="submit" size="lg" className="w-full max-md:hidden" disabled={save.pending}>
            {save.pending ? "Salvando…" : account ? "Salvar alterações" : "Cadastrar conta"}
          </Button>
          {account && (
            <Button variant="ghost" className="w-full text-[#ff7a7a] hover:text-[#ff9a9a]" onClick={() => setConfirmOpen(true)}>
              <Trash2 aria-hidden className="size-4" /> Apagar conta
            </Button>
          )}
          {remove.error && <InlineError message={remove.error.message} />}
        </aside>

        <MobileActionBar>
          <Button variant="secondary" size="lg" className="shrink-0" onClick={() => navigate("/admin/contas")}>
            Voltar
          </Button>
          <Button type="submit" size="lg" className="flex-1" disabled={save.pending}>
            {save.pending ? "Salvando…" : account ? "Salvar" : "Cadastrar conta"}
          </Button>
        </MobileActionBar>
      </form>

      {account && (
        <ConfirmDialog
          open={confirmOpen}
          title="Apagar esta conta?"
          description={
            <>
              <strong className="text-white">{account.handle}</strong> sai da vitrine na hora. Pedidos já feitos continuam
              no histórico. Para só tirar do ar, prefira marcar como vendida.
            </>
          }
          confirmLabel="Apagar"
          pending={remove.pending}
          onConfirm={() => void onDelete()}
          onClose={() => setConfirmOpen(false)}
        />
      )}
    </>
  );
}

export default function AccountEditorPage() {
  const { id } = useParams();
  const account = useAdminQuery((deps) => (id ? findAccount(deps, id) : Promise.resolve(null)), id ?? "new");

  if (account.status === "loading") return <LoadingBlock />;
  if (account.status === "error") return <ErrorState message={account.error.message} onRetry={account.reload} />;
  if (id && !account.data) {
    return (
      <EmptyState
        title="Conta não encontrada"
        description="Ela pode ter sido apagada."
        action={
          <Link to="/admin/contas" className="text-sm text-electric-soft underline-offset-4 hover:underline">
            Voltar para as contas
          </Link>
        }
      />
    );
  }
  return <AccountEditor key={id ?? "new"} account={account.data} />;
}
