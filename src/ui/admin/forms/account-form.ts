import { useState } from "react";
import { accountDataSchema, fieldErrorsOf } from "@/application/schemas";
import { slugify, type Account, type AccountData, type AccountStatus, type FacebookKind } from "@/domain/account";
import type { Platform } from "@/domain/platform";

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
  followers: string;
  price: string;
  status: AccountStatus;
  listedAt: string;
  description: string;
  images: string[];
  likes: string;
  following: string;
  posts: string;
  professional: boolean;
  views: string;
  videos: string;
  watchHours: string;
  monetized: boolean;
  facebookKind: FacebookKind;
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
    followers: "",
    price: "",
    status: "available",
    listedAt: today(),
    description: "",
    images: [],
    likes: "",
    following: "0",
    posts: "",
    professional: true,
    views: "",
    videos: "",
    watchHours: "",
    monetized: false,
    facebookKind: "page",
  };
}

const integerFormat = new Intl.NumberFormat("pt-BR");
const moneyFormat = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "1.250" ou "1250" viram 1250. Texto vazio ou inválido vira NaN para o zod acusar. */
export function parseInteger(text: string): number {
  const digits = text.replace(/[.\s]/g, "");
  return /^\d+$/.test(digits) ? Number(digits) : Number.NaN;
}

/** "370", "370,00" e "1.250,50" viram centavos. */
export function parseMoneyToCents(text: string): number {
  const normalized = text.replace(/[R$\s.]/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return Number.NaN;
  return Math.round(Number(normalized) * 100);
}

export function formatCentsInput(cents: number): string {
  return moneyFormat.format(cents / 100);
}

export function fromAccount(account: Account): AccountFormValues {
  const values: AccountFormValues = {
    ...emptyAccountForm(),
    platform: account.platform,
    displayName: account.displayName,
    handle: account.handle,
    slug: account.slug,
    slugEdited: true,
    niche: account.niche ?? "",
    followers: integerFormat.format(account.followers),
    price: formatCentsInput(account.price),
    status: account.status,
    listedAt: account.listedAt,
    description: account.description ?? "",
    images: account.images,
  };
  switch (account.platform) {
    case "tiktok":
      return { ...values, likes: integerFormat.format(account.stats.likes), following: integerFormat.format(account.stats.following) };
    case "instagram":
      return {
        ...values,
        posts: integerFormat.format(account.stats.posts),
        following: integerFormat.format(account.stats.following),
        professional: account.stats.professional,
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
      return { likes: parseInteger(values.likes), following: parseInteger(values.following) };
    case "instagram":
      return { posts: parseInteger(values.posts), following: parseInteger(values.following), professional: values.professional };
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

/** Formato que o caso de uso `saveAccount` valida. */
export function toRawAccount(values: AccountFormValues) {
  return {
    platform: values.platform,
    stats: statsOf(values),
    slug: values.slug,
    displayName: values.displayName,
    handle: values.handle,
    niche: values.niche,
    followers: parseInteger(values.followers),
    price: parseMoneyToCents(values.price),
    status: values.status,
    description: values.description,
    images: values.images,
    listedAt: values.listedAt,
  };
}

/** Erros de um item da galeria (`images.2`) aparecem no campo da galeria. */
function groupImageErrors(errors: AccountFormErrors): AccountFormErrors {
  const imageKey = Object.keys(errors).find((key) => key.startsWith("images."));
  if (!imageKey || errors.images) return errors;
  return { ...errors, images: errors[imageKey] ?? "Imagem inválida." };
}

export function validateAccountForm(
  values: AccountFormValues,
): { data: AccountData; errors: null } | { data: null; errors: AccountFormErrors } {
  const result = accountDataSchema.safeParse(toRawAccount(values));
  return result.success
    ? { data: result.data, errors: null }
    : { data: null, errors: groupImageErrors(fieldErrorsOf(result.error)) };
}

/** Ordem dos campos na tela, para levar o foco ao primeiro erro. */
export const ACCOUNT_FIELD_ORDER = [
  "displayName",
  "handle",
  "slug",
  "niche",
  "followers",
  "stats.likes",
  "stats.posts",
  "stats.following",
  "stats.views",
  "stats.videos",
  "stats.watchHours",
  "price",
  "listedAt",
  "description",
  "images",
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

  return { values, errors, set, validate, setErrors };
}
