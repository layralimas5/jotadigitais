import { useState } from "react";
import { accountDataSchema, fieldErrorsOf } from "@/application/schemas";
import { discountPercentOf, shopTierOf, slugify, type Account, type AccountData, type AccountSpec, type AccountStatus, type FacebookKind, type ShopTier } from "@/domain/account";
import { DEFAULT_COUNTRY, fallbackCountryName } from "@/domain/country";
import { formatBRL, formatCentsInput, parseMoneyToCents } from "@/domain/money";
import type { Platform } from "@/domain/platform";
import type { ProfileLookup, StoredProfileImages } from "@/domain/profile-lookup";

/**
 * Estado do formulário: números como texto (o que a pessoa digita) e os campos de todas as redes juntos,
 * para nada se perder se o Jota trocar a rede no meio do preenchimento.
 */
export interface AccountFormValues {
  platform: Platform;
  displayName: string;
  handle: string;
  slug: string;
  /** Enquanto falso, o endereço acompanha o nome do perfil. */
  slugEdited: boolean;
  niche: string;
  country: string;
  /** Só para a prévia da vitrine: o banco guarda o código e devolve o nome junto com a conta. */
  countryName: string;
  followers: string;
  /** Valor da conta. Com desconto preenchido, é ele que aparece riscado. */
  price: string;
  /** Valor com desconto (opcional): o que o cliente paga quando a conta está em oferta. */
  salePrice: string;
  status: AccountStatus;
  listedAt: string;
  description: string;
  avatarUrl: string;
  images: string[];
  likes: string;
  following: string;
  posts: string;
  professional: boolean;
  views: string;
  videos: string;
  watchHours: string;
  monetized: boolean;
  /** TikTok Shop piloto ou ativo, marcado pelo Jota. */
  shop: ShopTier;
  facebookKind: FacebookKind;
  /** Vazio quando a conta é da própria loja. */
  partnerId: string;
  profileUrl: string;
  statsSyncedAt: string | null;
  mockupBio: string;
  mockupCoverUrl: string;
  mockupPosts: string[];
  /** Ficha técnica escrita para esta conta; nula = automática. */
  specs: AccountSpec[] | null;
  tags: string[];
}

export type AccountFormErrors = Record<string, string>;

const today = () => new Date().toISOString().slice(0, 10);

export function emptyAccountForm(): AccountFormValues {
  return {
    platform: "tiktok",
    displayName: "",
    handle: "",
    slug: "",
    slugEdited: false,
    niche: "",
    country: DEFAULT_COUNTRY,
    countryName: fallbackCountryName(DEFAULT_COUNTRY),
    followers: "",
    price: "",
    salePrice: "",
    status: "available",
    listedAt: today(),
    description: "",
    avatarUrl: "",
    images: [],
    likes: "",
    following: "0",
    posts: "",
    professional: true,
    views: "",
    videos: "",
    watchHours: "",
    monetized: false,
    shop: "pilot",
    facebookKind: "page",
    partnerId: "",
    profileUrl: "",
    statsSyncedAt: null,
    mockupBio: "",
    mockupCoverUrl: "",
    mockupPosts: [],
    specs: null,
    tags: [],
  };
}

const integerFormat = new Intl.NumberFormat("pt-BR");

/** "1.250" ou "1250" viram 1250. Texto vazio ou inválido vira NaN para o zod acusar. */
export function parseInteger(text: string): number {
  const digits = text.replace(/[.\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

export { formatCentsInput, parseMoneyToCents };

export function fromAccount(account: Account): AccountFormValues {
  const values: AccountFormValues = {
    ...emptyAccountForm(),
    platform: account.platform,
    displayName: account.displayName,
    handle: account.handle,
    slug: account.slug,
    slugEdited: true,
    niche: account.niche ?? "",
    country: account.country ?? DEFAULT_COUNTRY,
    countryName: account.countryName,
    followers: integerFormat.format(account.followers),
    // Em oferta, o banco guarda o que o cliente paga em price e o valor anterior em compareAtPrice.
    price: formatCentsInput(account.compareAtPrice ?? account.price),
    salePrice: account.compareAtPrice === null ? "" : formatCentsInput(account.price),
    status: account.status,
    listedAt: account.listedAt,
    description: account.description ?? "",
    avatarUrl: account.avatarUrl ?? "",
    images: account.images,
    partnerId: account.partnerId ?? "",
    profileUrl: account.profileUrl ?? "",
    statsSyncedAt: account.statsSyncedAt ?? null,
    // Conta salva antes do mockup existir (ou do modo demonstração antigo) não tem o campo.
    mockupBio: account.mockup?.bio ?? "",
    mockupCoverUrl: account.mockup?.coverUrl ?? "",
    mockupPosts: account.mockup?.posts ?? [],
    specs: account.specs ?? null,
    tags: account.tags ?? [],
  };
  switch (account.platform) {
    case "tiktok":
      return {
        ...values,
        likes: integerFormat.format(account.stats.likes),
        following: integerFormat.format(account.stats.following),
        monetized: account.stats.monetized === true,
        shop: shopTierOf(account),
      };
    case "instagram":
      return {
        ...values,
        posts: integerFormat.format(account.stats.posts),
        following: integerFormat.format(account.stats.following),
        professional: account.stats.professional,
        monetized: account.stats.monetized === true,
      };
    case "youtube":
      return {
        ...values,
        views: integerFormat.format(account.stats.views),
        videos: integerFormat.format(account.stats.videos),
        watchHours: integerFormat.format(account.stats.watchHours),
        monetized: account.stats.monetized,
      };
    case "facebook":
      return {
        ...values,
        likes: integerFormat.format(account.stats.likes),
        monetized: account.stats.monetized,
        facebookKind: account.stats.kind,
      };
  }
}

function statsOf(values: AccountFormValues) {
  switch (values.platform) {
    case "tiktok":
      return {
        likes: parseInteger(values.likes),
        following: parseInteger(values.following),
        monetized: values.monetized,
        shop: values.shop,
      };
    case "instagram":
      return {
        posts: parseInteger(values.posts),
        following: parseInteger(values.following),
        professional: values.professional,
        monetized: values.monetized,
      };
    case "youtube":
      return {
        views: parseInteger(values.views),
        videos: parseInteger(values.videos),
        watchHours: parseInteger(values.watchHours),
        monetized: values.monetized,
      };
    case "facebook":
      return { kind: values.facebookKind, likes: parseInteger(values.likes), monetized: values.monetized };
  }
}

const hasSalePrice = (values: Pick<AccountFormValues, "salePrice">) => values.salePrice.trim() !== "";

/** O que o cliente paga e o valor riscado: com desconto, o valor da conta vira o anterior. */
function pricesOf(values: Pick<AccountFormValues, "price" | "salePrice">): { price: number; compareAtPrice: number | null } {
  const price = parseMoneyToCents(values.price);
  return hasSalePrice(values) ? { price: parseMoneyToCents(values.salePrice), compareAtPrice: price } : { price, compareAtPrice: null };
}

/** Formato que o caso de uso `saveAccount` valida. */
export function toRawAccount(values: AccountFormValues) {
  return {
    platform: values.platform,
    stats: statsOf(values),
    slug: values.slug,
    displayName: values.displayName,
    handle: values.handle,
    niche: values.niche,
    country: values.country,
    followers: parseInteger(values.followers),
    ...pricesOf(values),
    status: values.status,
    description: values.description,
    avatarUrl: values.avatarUrl || null,
    images: values.images,
    listedAt: values.listedAt,
    partnerId: values.partnerId || null,
    profileUrl: values.profileUrl || null,
    statsSyncedAt: values.statsSyncedAt,
    mockup: { bio: values.mockupBio || null, coverUrl: values.mockupCoverUrl || null, posts: values.mockupPosts },
    specs: values.specs,
    tags: values.tags,
  };
}

const formatOptional = (value: number | null, current: string) => (value === null ? current : integerFormat.format(value));

/**
 * Preenche o formulário com o que veio da rede. Números e nomes são trocados; o que a rede não mostra
 * (preço, status, horas de exibição, monetização) fica como estava para o Jota completar.
 */
/** Mesmo limite do campo Bio do mockup. */
const MOCKUP_BIO_MAX = 150;

const clampBio = (bio: string) => (bio.length > MOCKUP_BIO_MAX ? `${bio.slice(0, MOCKUP_BIO_MAX - 1).trimEnd()}…` : bio);

/** O que a rede não entregou mantém o que já estava na ficha. */
export function applyProfileLookup(values: AccountFormValues, profile: ProfileLookup, images: StoredProfileImages): AccountFormValues {
  const next: AccountFormValues = {
    ...values,
    platform: profile.platform,
    handle: profile.handle,
    displayName: profile.displayName,
    followers: integerFormat.format(profile.followers),
    likes: formatOptional(profile.likes, values.likes),
    following: formatOptional(profile.following, values.following),
    posts: formatOptional(profile.posts, values.posts),
    videos: formatOptional(profile.videos, values.videos),
    views: formatOptional(profile.views, values.views),
    professional: profile.platform === "instagram" && profile.professional !== null ? profile.professional : values.professional,
    avatarUrl: images.avatarUrl ?? values.avatarUrl,
    mockupBio: profile.bio ? clampBio(profile.bio.trim()) : values.mockupBio,
    mockupCoverUrl: images.coverUrl ?? values.mockupCoverUrl,
    mockupPosts: images.postUrls.length > 0 ? images.postUrls : values.mockupPosts,
    profileUrl: profile.profileUrl,
    statsSyncedAt: profile.fetchedAt,
  };
  return values.slugEdited ? next : { ...next, slug: slugify(profile.displayName) };
}

/** Erros de um item da galeria (`images.2`) aparecem no campo da galeria. */
function groupImageErrors(errors: AccountFormErrors): AccountFormErrors {
  const imageKey = Object.keys(errors).find((key) => key.startsWith("images."));
  if (!imageKey || errors.images) return errors;
  return { ...errors, images: errors[imageKey] ?? "Imagem inválida." };
}

/**
 * Em oferta, o banco valida o preço com desconto como `price` e o valor da conta como `compareAtPrice`:
 * cada erro volta para o campo em que o Jota digitou.
 */
function placeOfferErrors(errors: AccountFormErrors, values: AccountFormValues): AccountFormErrors {
  if (!hasSalePrice(values)) return errors;
  const { price: saleError, compareAtPrice: compareError, ...rest } = errors;
  const placed: AccountFormErrors = { ...rest };
  if (saleError) placed.salePrice = saleError;
  if (compareError) {
    if (Number.isNaN(parseMoneyToCents(values.price))) placed.price = "Informe o preço.";
    else if (saleError) placed.price = compareError;
    else placed.salePrice = compareError;
  }
  return placed;
}

/** Prévia da oferta para o Jota conferir na ficha: "de R$ 550,00 por R$ 499,00 (9% off)". Nula sem desconto válido. */
export function offerHintOf(values: Pick<AccountFormValues, "price" | "salePrice">): string | null {
  const { price, compareAtPrice } = pricesOf(values);
  if (compareAtPrice === null || Number.isNaN(price) || Number.isNaN(compareAtPrice)) return null;
  const percent = discountPercentOf({ price, compareAtPrice });
  return percent === null ? null : `No site: de ${formatBRL(compareAtPrice)} por ${formatBRL(price)} (${percent}% off).`;
}

export function validateAccountForm(
  values: AccountFormValues,
): { data: AccountData; errors: null } | { data: null; errors: AccountFormErrors } {
  const result = accountDataSchema.safeParse(toRawAccount(values));
  return result.success
    ? { data: result.data, errors: null }
    : { data: null, errors: placeOfferErrors(groupImageErrors(fieldErrorsOf(result.error)), values) };
}

/** O que entra no lugar de cada campo ainda vazio ou inválido, só para desenhar a prévia. */
const PREVIEW_FALLBACK: Record<string, Partial<AccountFormValues>> = {
  displayName: { displayName: "Nome do perfil" },
  handle: { handle: "@suaconta" },
  slug: { slug: "previa" },
  niche: { niche: "" },
  followers: { followers: "0" },
  price: { price: "1" },
  salePrice: { salePrice: "" },
  description: { description: "" },
  avatarUrl: { avatarUrl: "" },
  images: { images: [] },
  listedAt: { listedAt: today() },
  profileUrl: { profileUrl: "" },
  "mockup.bio": { mockupBio: "" },
  "mockup.coverUrl": { mockupCoverUrl: "" },
  "mockup.posts": { mockupPosts: [] },
  // Linha da ficha ainda vazia: a prévia mostra a ficha automática até ela ser preenchida.
  specs: { specs: null },
  tags: { tags: [] },
  "stats.likes": { likes: "0" },
  "stats.following": { following: "0" },
  "stats.posts": { posts: "0" },
  "stats.views": { views: "0" },
  "stats.videos": { videos: "0" },
  "stats.watchHours": { watchHours: "0" },
};

const MAX_PREVIEW_PASSES = 3;

/** Erros de item de lista (images.2, specs.0.label) usam o substituto da lista inteira. */
function previewFallbackKey(key: string): string {
  if (key.startsWith("images.")) return "images";
  if (key.startsWith("mockup.posts")) return "mockup.posts";
  if (key.startsWith("specs")) return "specs";
  if (key.startsWith("tags")) return "tags";
  return key;
}

/**
 * Conta de mentira para a prévia da vitrine: usa o que já foi digitado e completa o resto com exemplos,
 * para o card aparecer desde o primeiro campo. Nulo só se algum campo não tiver substituto.
 */
export function previewAccountOf(values: AccountFormValues, id: string): Account | null {
  let draft = values;
  for (let pass = 0; pass < MAX_PREVIEW_PASSES; pass += 1) {
    const result = validateAccountForm(draft);
    if (result.data) {
      // Preço digitado, mesmo inválido (vira 0); desconto só se passou na validação.
      const { price } = pricesOf({ price: values.price, salePrice: draft.salePrice });
      return { ...result.data, id, reservedUntil: null, countryName: values.countryName, price: Number.isNaN(price) ? 0 : price };
    }
    for (const key of Object.keys(result.errors)) {
      const fallback = PREVIEW_FALLBACK[previewFallbackKey(key)];
      if (!fallback) return null;
      draft = { ...draft, ...fallback };
    }
  }
  return null;
}

/** Ordem dos campos na tela, para levar o foco ao primeiro erro. */
export const ACCOUNT_FIELD_ORDER = [
  "profileUrl",
  "displayName",
  "handle",
  "slug",
  "niche",
  "country",
  "followers",
  "stats.likes",
  "stats.posts",
  "stats.following",
  "stats.views",
  "stats.videos",
  "stats.watchHours",
  "tags",
  "price",
  "salePrice",
  "listedAt",
  "description",
  "images",
  "mockup.bio",
  "mockup.coverUrl",
  "mockup.posts",
  "specs",
] as const;

export function useAccountForm(initial: AccountFormValues) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const set = <K extends keyof AccountFormValues>(field: K, value: AccountFormValues[K]) => {
    const next = { ...values, [field]: value };
    if (field === "displayName" && !values.slugEdited) next.slug = slugify(String(value));
    if (field === "slug") next.slugEdited = true;
    setValues(next);
    if (submitted) setErrors(validateAccountForm(next).errors ?? {});
  };

  const validate = () => {
    setSubmitted(true);
    const result = validateAccountForm(values);
    setErrors(result.errors ?? {});
    return result;
  };

  /** Troca vários campos de uma vez (ex.: dados puxados da rede) e revalida se o formulário já foi enviado. */
  const replace = (next: AccountFormValues) => {
    setValues(next);
    if (submitted) setErrors(validateAccountForm(next).errors ?? {});
  };

  return { values, errors, set, replace, validate, setErrors };
}
