import { ArrowLeft, MessageCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { deleteAccount, findAccount, findAccountAccess, listPartners, saveAccount, saveAccountAccess } from "@/application/admin-use-cases";
import { ACCOUNT_STATUSES, MAX_MOCKUP_POSTS, MONETIZED_PLATFORMS, type Account, type AccountData, type AccountStatus } from "@/domain/account";
import { helperCan } from "@/domain/admin-user";
import type { AccountAccess } from "@/domain/email-account";
import { ACCOUNT_STATUS_LABEL } from "@/ui/lib/account-presenter";
import { AUDIENCE_LABEL, PLATFORM_LABEL, type Platform } from "@/domain/platform";
import { Button } from "@/ui/components/Button";
import { AccountCard } from "@/ui/components/account/AccountCard";
import { TextField } from "@/ui/components/form/Fields";
import { PlatformGlyph } from "@/ui/components/PlatformGlyph";
import { EmptyState, ErrorState } from "@/ui/components/StateViews";
import { FormSection, LoadingBlock, PageHeader } from "../components/AdminUi";
import {
  AccountAccessSection,
  accessFormOf,
  sameAccess,
  useCanEditAccess,
  validateAccess,
  type AccessFormErrors,
  type AccessFormValues,
} from "../accounts/AccountAccessSection";
import { AccountPageSection } from "../accounts/AccountPageSection";
import { AccountTagsField } from "../accounts/AccountTagsField";
import { CountryField } from "../accounts/CountryField";
import { ProfileImport } from "../accounts/ProfileImport";
import { ShareAccountDialog } from "../accounts/ShareAccountDialog";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SegmentedField, SelectField, TextAreaField, ToggleField } from "../components/FormControls";
import { FormFooter } from "../components/FormFooter";
import { AvatarField, GalleryField } from "../components/ImageUpload";
import {
  ACCOUNT_FIELD_ORDER,
  applyProfileLookup,
  emptyAccountForm,
  fromAccount,
  previewAccountOf,
  useAccountForm,
  type AccountFormErrors,
  type AccountFormValues,
} from "../forms/account-form";
import { useAdminQuery, useMutation } from "../hooks";
import { formatPercent } from "../lib/percent";
import { useToast } from "../toast";
import { useViewAccess } from "../admin-view";

const STATUS_OPTIONS = ACCOUNT_STATUSES.map((value) => ({ value, label: ACCOUNT_STATUS_LABEL[value] }));
const platformOption = (value: Platform) => ({
  value,
  label: PLATFORM_LABEL[value],
  icon: <PlatformGlyph platform={value} className="size-4" />,
});

/** Contas novas só nas redes monetizáveis; uma conta antiga de Facebook continua editável. */
const platformOptionsFor = (current: Platform) =>
  (MONETIZED_PLATFORMS as readonly Platform[]).includes(current)
    ? MONETIZED_PLATFORMS.map(platformOption)
    : [...MONETIZED_PLATFORMS, current].map(platformOption);
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
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {followers}
            <NumberInput label="Curtidas" name="stats.likes" value={values.likes} error={errors["stats.likes"]} onChange={(value) => set("likes", value)} />
            <NumberInput label="Seguindo" name="stats.following" value={values.following} error={errors["stats.following"]} onChange={(value) => set("following", value)} />
          </div>
        </>
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
        </>
      );
  }
}

/** Quantas fotos de post cada mockup mostra. */
const MOCKUP_POSTS_BY_PLATFORM: Record<Platform, { count: number; label: string; hint: string }> = {
  instagram: { count: MAX_MOCKUP_POSTS, label: "Fotos da grade", hint: "Até 9 fotos de posts, na ordem da grade (da esquerda para a direita)." },
  tiktok: { count: 3, label: "Capas de vídeo", hint: "Até 3 capas dos vídeos mais recentes. Sem capas, o mockup mostra a vitrine do TikTok Shop." },
  youtube: { count: 2, label: "Capas de vídeo", hint: "Até 2 capas de vídeos do canal." },
  facebook: { count: 1, label: "Foto de um post", hint: "A foto que aparece no post de exemplo." },
};

const firstErrorOf = (errors: AccountFormErrors, prefix: string) =>
  errors[prefix] ?? Object.entries(errors).find(([key]) => key.startsWith(`${prefix}.`))?.[1];

interface MockupSectionProps {
  values: AccountFormValues;
  errors: AccountFormErrors;
  set: SetField;
}

/** Enfeites do mockup do celular. Nome, @, foto de perfil e números vêm dos campos de cima. */
function MockupSection({ values, errors, set }: MockupSectionProps) {
  const posts = MOCKUP_POSTS_BY_PLATFORM[values.platform];
  const hasCover = values.platform === "youtube" || values.platform === "facebook";
  return (
    <FormSection
      title="Mockup do celular (opcional)"
      description="O celular da página da conta. Nome, @, foto de perfil e números saem dos campos acima; aqui ficam a bio e as fotos. O Puxar dados preenche o que a rede mostrar, e a prévia ao lado mostra o resultado."
    >
      <TextAreaField
        label="Bio"
        name="mockup.bio"
        rows={3}
        maxLength={150}
        value={values.mockupBio}
        onChange={(event) => set("mockupBio", event.target.value)}
        error={errors["mockup.bio"]}
        hint="Até 150 caracteres. Vazia, o mockup fica sem bio."
      />
      {hasCover && (
        <GalleryField
          label={values.platform === "youtube" ? "Capa do canal" : "Capa da página"}
          folder="accounts"
          images={values.mockupCoverUrl ? [values.mockupCoverUrl] : []}
          max={1}
          onChange={(images) => set("mockupCoverUrl", images[0] ?? "")}
          error={errors["mockup.coverUrl"]}
          hint="Uma imagem larga. Sem capa, o mockup usa um degradê."
        />
      )}
      {posts.count > 0 && (
        <GalleryField
          label={posts.label}
          folder="accounts"
          images={values.mockupPosts}
          max={posts.count}
          onChange={(images) => set("mockupPosts", images)}
          error={firstErrorOf(errors, "mockup.posts")}
          hint={posts.hint}
        />
      )}
    </FormSection>
  );
}

function LivePreview({ values, accountId }: { values: AccountFormValues; accountId: string }) {
  const preview = previewAccountOf(values, accountId);
  if (!preview) {
    return (
      <p className="rounded-3xl border border-dashed border-line-strong p-6 text-center text-sm text-mist">
        Preencha os campos para ver como a conta aparece na vitrine.
      </p>
    );
  }
  return (
    <div>
      <div className="pointer-events-none" aria-label="Prévia do card na vitrine">
        <AccountCard account={preview} />
      </div>
      <p className="mt-2 text-xs text-mist">Atualiza enquanto você preenche. Campos vazios aparecem com um exemplo.</p>
    </div>
  );
}

const OWN_STOCK_OPTION = { value: "", label: "Da loja (sem parceiro)" };

/** Parceiros ativos, mais o atual mesmo que tenha sido desativado, para não sumir da conta sem querer. */
/** Ajudante sem a área Parceiros não vê a lista (pix e comissões): o parceiro já escolhido continua salvo na conta. */
function PartnerField({ value, onChange }: { value: string; onChange: (partnerId: string) => void }) {
  const access = useViewAccess();
  if (access?.role === "helper" && !helperCan(access, "partners")) {
    return (
      <p className="rounded-xl border border-line bg-ink/50 px-4 py-3 text-xs text-mist">
        {value ? "Esta conta é de um parceiro. Só o admin troca o parceiro." : "O parceiro da conta é definido pelo admin."}
      </p>
    );
  }
  return <PartnerSelect value={value} onChange={onChange} />;
}

function PartnerSelect({ value, onChange }: { value: string; onChange: (partnerId: string) => void }) {
  const partners = useAdminQuery(listPartners, "account-partners");
  if (partners.status !== "success") {
    return (
      <SelectField
        label="Parceiro"
        name="partnerId"
        disabled
        value=""
        options={[{ value: "", label: partners.status === "error" ? "Não foi possível carregar" : "Carregando…" }]}
        hint={partners.status === "error" ? partners.error.message : undefined}
      />
    );
  }
  const options = [
    OWN_STOCK_OPTION,
    ...partners.data
      .filter((partner) => partner.active || partner.id === value)
      .map((partner) => ({ value: partner.id, label: `${partner.name} (${formatPercent(partner.commissionPercent)})` })),
  ];
  return (
    <SelectField
      label="Parceiro"
      name="partnerId"
      value={value}
      options={options}
      onChange={(event) => onChange(event.target.value)}
      hint="Quem forneceu a conta. A comissão dele sai das vendas finalizadas."
    />
  );
}

/** Leva ao primeiro campo com erro; nas listas (specs.0.label), ao item exato. */
function focusFirstError(form: HTMLFormElement, errors: AccountFormErrors) {
  const keys = Object.keys(errors);
  for (const field of ACCOUNT_FIELD_ORDER) {
    const key = keys.find((item) => item === field || item.startsWith(`${field}.`));
    if (!key) continue;
    (form.querySelector<HTMLElement>(`[name="${key}"]`) ?? form.querySelector<HTMLElement>(`[name^="${field}."]`))?.focus();
    return;
  }
}

interface AccountEditorProps {
  account: Account | null;
  /** Login salvo na aba E-mails. `undefined` quando quem edita não tem acesso às senhas: a seção nem aparece. */
  initialAccess: AccountAccess | null | undefined;
}

function AccountEditor({ account, initialAccess }: AccountEditorProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const form = useAccountForm(account ? fromAccount(account) : emptyAccountForm());
  const { values, errors, set } = form;
  const [sharing, setSharing] = useState(false);
  const showAccess = initialAccess !== undefined;
  const [accessStart] = useState(() => accessFormOf(initialAccess ?? null));
  const [accessValues, setAccessValues] = useState<AccessFormValues>(accessStart);
  const [accessErrors, setAccessErrors] = useState<AccessFormErrors>({});
  const save = useMutation((deps, data: AccountData) => saveAccount(deps, account?.id ?? null, data));
  const saveAccess = useMutation((deps, saved: Account, raw: AccessFormValues) => saveAccountAccess(deps, saved, raw));
  const remove = useMutation(async (deps, id: string) => {
    await deleteAccount(deps, id);
    return true;
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const result = form.validate();
    const nextAccessErrors = showAccess ? validateAccess(accessValues) : {};
    setAccessErrors(nextAccessErrors);
    const accessInvalid = Object.values(nextAccessErrors).some(Boolean);
    if (!result.data || accessInvalid) {
      if (!result.data) focusFirstError(formElement, result.errors);
      else formElement.querySelector<HTMLElement>(`[name="access.${nextAccessErrors.email ? "email" : "password"}"]`)?.focus();
      toast.show("Revise os campos marcados em vermelho.", "error");
      return;
    }
    const saved = await save.run(result.data);
    if (!saved) {
      toast.show("Não foi possível salvar. Veja o aviso no formulário.", "error");
      return;
    }
    if (showAccess && !sameAccess(accessValues, accessStart)) {
      const accessSaved = await saveAccess.run(saved, accessValues);
      if (accessSaved === undefined) {
        toast.show(`Conta ${saved.handle} salva, mas o e-mail e a senha não. Tente salvar de novo.`, "error");
        if (!account) navigate(`/admin/contas/${saved.id}`, { replace: true });
        return;
      }
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

      <form noValidate onSubmit={onSubmit} aria-busy={save.pending} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="space-y-5">
          <FormSection title="Puxar dados da rede" description="Cole o link do perfil e o sistema preenche nome, @, foto, números, bio e as fotos do mockup.">
            <ProfileImport
              url={values.profileUrl}
              syncedAt={values.statsSyncedAt}
              error={errors.profileUrl}
              onUrlChange={(url) => set("profileUrl", url)}
              onImported={({ profile, images }) => {
                form.replace(applyProfileLookup(values, profile, images));
                toast.show(`Dados de ${profile.handle} puxados. Revise e salve.`);
              }}
            />
          </FormSection>

          <FormSection title="Rede social">
            <SegmentedField<Platform>
              legend="Em qual rede é a conta?"
              name="platform"
              value={values.platform}
              options={platformOptionsFor(values.platform)}
              onChange={(value) => set("platform", value)}
              columns={values.platform === "facebook" ? 4 : 3}
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
            <div className="grid gap-4 sm:grid-cols-3">
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
              <CountryField
                value={values.country}
                error={errors.country}
                onChange={(country) => form.replace({ ...values, country: country.code, countryName: country.name })}
              />
              <TextField label="Nicho (opcional)" name="niche" placeholder="Ex.: Moda, Humor" value={values.niche} onChange={(event) => set("niche", event.target.value)} error={errors.niche} />
            </div>
          </FormSection>

          <FormSection title="Números da conta" description="Copie direto do perfil no dia do anúncio.">
            <PlatformStatsFields values={values} errors={errors} set={set} />
          </FormSection>

          <FormSection title="Tags" description="As marcadas aparecem no card da vitrine e na página da conta.">
            <AccountTagsField
              platform={values.platform}
              value={{ shop: values.shop, monetized: values.monetized, tags: values.tags }}
              error={errors.tags ?? Object.entries(errors).find(([key]) => key.startsWith("tags."))?.[1]}
              onChange={(next) => form.replace({ ...values, ...next })}
            />
          </FormSection>

          <FormSection title="Venda">
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField label="Preço (R$)" name="price" inputMode="decimal" placeholder="370,00" value={values.price} onChange={(event) => set("price", event.target.value)} error={errors.price} />
              <SelectField label="Status" name="status" value={values.status} options={STATUS_OPTIONS} onChange={(event) => set("status", event.target.value as AccountStatus)} />
              <TextField label="Anunciada em" name="listedAt" type="date" value={values.listedAt} onChange={(event) => set("listedAt", event.target.value)} error={errors.listedAt} />
            </div>
            <PartnerField value={values.partnerId} onChange={(partnerId) => set("partnerId", partnerId)} />
          </FormSection>

          {showAccess && (
            <AccountAccessSection
              values={accessValues}
              errors={accessErrors}
              onChange={(next) => {
                setAccessValues(next);
                if (Object.values(accessErrors).some(Boolean)) setAccessErrors(validateAccess(next));
              }}
            />
          )}

          <AccountPageSection values={values} errors={errors} set={set} accountId={account?.id ?? "preview"} />

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

          <MockupSection values={values} errors={errors} set={set} />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <p className="text-sm font-medium text-fog">Prévia na vitrine</p>
          <LivePreview values={values} accountId={account?.id ?? "preview"} />
        </aside>

        <FormFooter
          className="lg:col-span-2"
          submitLabel={account ? "Salvar alterações" : "Cadastrar conta"}
          mobileSubmitLabel={account ? "Salvar" : "Cadastrar conta"}
          pending={save.pending || saveAccess.pending}
          onCancel={() => navigate("/admin/contas")}
          onDelete={account ? () => setConfirmOpen(true) : undefined}
          deleteLabel="Apagar conta"
          errors={[
            Object.keys(errors).length > 0 || Object.values(accessErrors).some(Boolean) ? "Revise os campos marcados em vermelho." : null,
            save.error?.message,
            saveAccess.error?.message,
            remove.error?.message,
          ]}
          extraActions={
            account && (
              <Button variant="secondary" onClick={() => setSharing(true)}>
                <MessageCircle aria-hidden className="size-4 text-[#25d366]" /> Enviar pelo WhatsApp
              </Button>
            )
          }
        />
      </form>

      <ShareAccountDialog account={sharing ? account : null} onClose={() => setSharing(false)} />
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
  const canEditAccess = useCanEditAccess();
  const account = useAdminQuery((deps) => (id ? findAccount(deps, id) : Promise.resolve(null)), id ?? "new");
  const access = useAdminQuery(
    (deps) => (id && canEditAccess ? findAccountAccess(deps, id) : Promise.resolve(null)),
    `account-access:${id ?? "new"}:${canEditAccess ? "on" : "off"}`,
  );

  if (account.status === "loading" || access.status === "loading") return <LoadingBlock />;
  if (account.status === "error") return <ErrorState message={account.error.message} onRetry={account.reload} />;
  if (access.status === "error") return <ErrorState message={access.error.message} onRetry={access.reload} />;
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
  return <AccountEditor key={id ?? "new"} account={account.data} initialAccess={canEditAccess ? access.data : undefined} />;
}
