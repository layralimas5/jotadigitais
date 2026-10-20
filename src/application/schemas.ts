import { z } from "zod";
import { ACCOUNT_STATUSES } from "@/domain/account";
import { BRAZIL_STATES, MIN_BUYER_AGE, OLDEST_BIRTH_DATE, ageOn, isValidDocument } from "@/domain/brazil";
import { EXPENSE_CATEGORIES, EXPENSE_PAYMENT_METHODS, REVENUE_CATEGORIES, toLocalIsoDate } from "@/domain/finance";
import { LEAD_SOURCES, LEAD_STAGES } from "@/domain/lead";
import { MAX_TEMPLATE_LENGTH } from "@/domain/message-template";
import { PLATFORMS } from "@/domain/platform";
import { TESTIMONIAL_KINDS } from "@/domain/testimonial";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

// ---------------------------------------------------------------------------
// Ficha do cliente (checkout e cadastro manual usam as mesmas regras)
// ---------------------------------------------------------------------------

const personName = z.string().trim().min(2, "Informe o nome.").max(80, "Use no máximo 80 caracteres.");

const optionalWhatsapp = z
  .string()
  .nullable()
  .transform((value) => onlyDigits(value ?? ""))
  .refine((digits) => digits === "" || (digits.length >= 10 && digits.length <= 13), {
    message: "Número de WhatsApp inválido.",
  })
  .transform((digits) => digits || null);

const optionalInstagram = z
  .string()
  .nullable()
  .transform((value) => value?.trim() ?? "")
  .transform((value) => (value && !value.startsWith("@") ? `@${value}` : value))
  .refine((value) => value === "" || /^@[A-Za-z0-9._]{1,30}$/.test(value), {
    message: "Use só letras, números, ponto e sublinhado.",
  })
  .transform((value) => value || null);

/** Campo de escolha opcional: "" (nada selecionado) vira nulo. */
const optionalChoice = <const T extends readonly [string, ...string[]]>(values: T) =>
  z
    .union([z.enum(values), z.literal(""), z.null()])
    .transform((value): T[number] | null => (value ? value : null));


const requiredEmail = z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido."));

const requiredWhatsapp = z
  .string()
  .transform(onlyDigits)
  .refine((digits) => digits.length >= 10 && digits.length <= 13, { message: "Informe o WhatsApp com DDD." });

/** CPF ou CNPJ com dígito verificador conferido; pontuação é ignorada. */
const requiredDocument = z
  .string()
  .transform(onlyDigits)
  .superRefine((digits, ctx) => {
    if (!digits) ctx.addIssue({ code: "custom", message: "Informe o CPF ou CNPJ." });
    else if (!isValidDocument(digits)) ctx.addIssue({ code: "custom", message: "CPF ou CNPJ inválido. Confira os números." });
  });

/** Data de nascimento real (de 1900 até hoje); com `minAge`, também confere a idade mínima. */
const birthDateField = (minAge = 0) =>
  z.string().superRefine((value, ctx) => {
    const today = toLocalIsoDate(new Date());
    if (!value) ctx.addIssue({ code: "custom", message: "Informe a data de nascimento." });
    else if (!z.iso.date().safeParse(value).success || value < OLDEST_BIRTH_DATE || value > today) {
      ctx.addIssue({ code: "custom", message: "Data de nascimento inválida." });
    } else if (ageOn(value, today) < minAge) {
      ctx.addIssue({ code: "custom", message: `A compra é só para maiores de ${minAge} anos.` });
    }
  });

const cityField = z.string().trim().min(2, "Informe a cidade.").max(60, "Use no máximo 60 caracteres.");

const stateField = z.enum(BRAZIL_STATES, { message: "Escolha o estado." });


const checkoutProfileShape = {
  name: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
  document: requiredDocument,
  birthDate: birthDateField(MIN_BUYER_AGE),
  email: requiredEmail,
  emailConfirmation: z.string().trim().toLowerCase(),
  whatsapp: requiredWhatsapp,
  instagram: optionalInstagram,
  city: cityField,
  state: stateField,
};

const emailsMatch = (data: { email: string; emailConfirmation: string }) => data.email === data.emailConfirmation;
const EMAILS_MISMATCH = { path: ["emailConfirmation"], message: "Os e-mails não conferem." };

/** Primeiro passo do checkout: a ficha completa, conferida antes de mostrar o pagamento. */
export const checkoutProfileSchema = z.object(checkoutProfileShape).refine(emailsMatch, EMAILS_MISMATCH);

export const checkoutSchema = z
  .object({
    ...checkoutProfileShape,
    paymentMethod: z.enum(["pix", "card"], { message: "Escolha a forma de pagamento." }),
    acceptedTerms: z.literal(true, { message: "Você precisa aceitar os termos para continuar." }),
  })
  .refine(emailsMatch, EMAILS_MISMATCH);

export type CheckoutInput = z.input<typeof checkoutSchema>;
export type CheckoutData = z.output<typeof checkoutSchema>;

// ---------------------------------------------------------------------------
// Contas (mesmas regras do banco: ver constraints em supabase/migrations)
// ---------------------------------------------------------------------------

export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const HANDLE_PATTERN = /^@[A-Za-z0-9._-]{1,60}$/;

const count = z
  .number({ message: "Informe um número." })
  .int("Use um número inteiro.")
  .min(0, "Não pode ser negativo.")
  .max(2_000_000_000, "Número alto demais.");

/** URL da imagem enviada. No modo demonstração ela é um data URL, que passa de longe do limite do banco. */
const fitsImageLimit = (value: string) => value.startsWith("data:image/") || value.length <= 500;
const IMAGE_TOO_LONG = "Endereço de imagem longo demais.";

const imageUrl = z.string().min(1, "Envie o print.").refine(fitsImageLimit, IMAGE_TOO_LONG);

const optionalImageUrl = z
  .string()
  .nullable()
  .default(null)
  .transform((value) => value || null)
  .refine((value) => value === null || fitsImageLimit(value), IMAGE_TOO_LONG);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullable()
    .transform((value) => (value ? value : null));

// Contas salvas antes da monetização no TikTok e no Instagram chegam sem o campo: valem como não monetizadas.
export const tiktokStatsSchema = z.object({ likes: count, following: count, monetized: z.boolean().default(false) });
export const instagramStatsSchema = z.object({
  posts: count,
  following: count,
  professional: z.boolean(),
  monetized: z.boolean().default(false),
});
export const youtubeStatsSchema = z.object({
  views: count,
  videos: count,
  watchHours: count,
  monetized: z.boolean(),
});
export const facebookStatsSchema = z.object({
  kind: z.enum(["page", "profile"]),
  likes: count,
  monetized: z.boolean(),
});

export const platformStatsSchema = z.discriminatedUnion("platform", [
  z.object({ platform: z.literal("tiktok"), stats: tiktokStatsSchema }),
  z.object({ platform: z.literal("instagram"), stats: instagramStatsSchema }),
  z.object({ platform: z.literal("youtube"), stats: youtubeStatsSchema }),
  z.object({ platform: z.literal("facebook"), stats: facebookStatsSchema }),
]);

export const accountBaseSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1, "Informe o endereço da página.")
    .max(80, "Endereço longo demais.")
    .regex(SLUG_PATTERN, "Use só letras minúsculas, números e hífen."),
  displayName: z.string().trim().min(2, "Informe o nome do perfil.").max(80, "Nome longo demais."),
  handle: z
    .string()
    .trim()
    .min(1, "Informe o @ da conta.")
    .transform((value) => (value.startsWith("@") ? value : `@${value}`))
    .pipe(z.string().regex(HANDLE_PATTERN, "Use só letras, números, ponto, hífen e sublinhado.")),
  niche: optionalText(40),
  followers: count,
  price: z
    .number({ message: "Informe o preço." })
    .int()
    .min(100, "O preço mínimo é R$ 1,00.")
    .max(100_000_000, "Preço alto demais."),
  status: z.enum(ACCOUNT_STATUSES),
  description: optionalText(2000),
  avatarUrl: optionalImageUrl,
  images: z.array(imageUrl).max(8, "Use no máximo 8 imagens."),
  listedAt: z.iso.date("Data inválida."),
  partnerId: z.string().min(1).nullable().default(null),
  profileUrl: z
    .string()
    .trim()
    .max(300, "Link longo demais.")
    .nullable()
    .default(null)
    .transform((value) => value || null)
    .refine((value) => value === null || /^https:\/\/[^\s]+$/.test(value), "Use o link completo, começando com https://."),
  statsSyncedAt: z.iso.datetime({ offset: true }).nullable().default(null),
});

export const accountDataSchema = z.intersection(accountBaseSchema, platformStatsSchema);

// ---------------------------------------------------------------------------
// Depoimentos
// ---------------------------------------------------------------------------

export const testimonialDataSchema = z.object({
  kind: z.enum(TESTIMONIAL_KINDS),
  title: z.string().trim().min(2, "Informe o título.").max(60, "Use no máximo 60 caracteres."),
  subtitle: z.string().trim().min(2, "Informe o complemento.").max(60, "Use no máximo 60 caracteres."),
  imageUrl,
  imageAlt: z
    .string()
    .trim()
    .min(10, "Descreva o print com pelo menos 10 caracteres.")
    .max(300, "Use no máximo 300 caracteres."),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  published: z.boolean(),
});

// ---------------------------------------------------------------------------
// CRM (mesmas regras da tabela leads)
// ---------------------------------------------------------------------------


/** Cliente cadastrado à mão: mesma ficha completa do checkout, mais origem e anotações. */
export const customerRecordSchema = z.object({
  name: personName,
  document: requiredDocument,
  birthDate: birthDateField(),
  email: requiredEmail,
  whatsapp: requiredWhatsapp,
  instagram: optionalInstagram,
  city: cityField,
  state: stateField,
  source: z.enum(LEAD_SOURCES, { message: "Escolha como o cliente chegou." }),
  interest: optionalChoice(PLATFORMS),
  notes: optionalText(2000),
});

export const leadDataSchema = z.object({
  name: personName,
  whatsapp: optionalWhatsapp,
  instagram: optionalInstagram,
  source: z.enum(LEAD_SOURCES),
  interest: z.enum(PLATFORMS).nullable(),
  stage: z.enum(LEAD_STAGES),
  budget: z
    .number({ message: "Valor inválido. Ex.: 400 ou 1.250,00." })
    .int()
    .min(0, "Não pode ser negativo.")
    .max(100_000_000, "Valor alto demais.")
    .nullable(),
  nextFollowUp: z.iso.date("Data inválida.").nullable(),
  notes: optionalText(2000),
});

// ---------------------------------------------------------------------------
// Parceiros (mesmas regras da tabela partners)
// ---------------------------------------------------------------------------

export const partnerDataSchema = z.object({
  name: personName,
  whatsapp: optionalWhatsapp,
  instagram: optionalInstagram,
  pixKey: optionalText(140),
  commissionPercent: z
    .number({ message: "Informe a porcentagem. Ex.: 30." })
    .min(0, "Não pode ser negativa.")
    .max(100, "Use no máximo 100%.")
    .multipleOf(0.01, "Use no máximo duas casas decimais."),
  notes: optionalText(2000),
  active: z.boolean(),
});

// ---------------------------------------------------------------------------
// Usuários do sistema
// ---------------------------------------------------------------------------

export const newAdminUserSchema = z.object({
  name: personName,
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(8, "Use pelo menos 8 caracteres.").max(72, "Use no máximo 72 caracteres."),
});

// ---------------------------------------------------------------------------
// Automação: modelos de mensagem
// ---------------------------------------------------------------------------

const templateBody = z
  .string()
  .trim()
  .min(1, "Escreva a mensagem.")
  .max(MAX_TEMPLATE_LENGTH, `Use no máximo ${MAX_TEMPLATE_LENGTH} caracteres.`);

export const messageTemplatesSchema = z.object({
  order_received: templateBody,
  payment_confirmed: templateBody,
  order_delivered: templateBody,
  crm_follow_up: templateBody,
  customer_hello: templateBody,
  account_offer: templateBody,
});

// ---------------------------------------------------------------------------
// Financeiro (mesmas regras da tabela expenses)
// ---------------------------------------------------------------------------

const moneyAmount = z
  .number({ message: "Informe o valor. Ex.: 150 ou 1.250,00." })
  .int()
  .min(1, "O valor precisa ser maior que zero.")
  .max(100_000_000, "Valor alto demais.");

/** Seleção opcional de um cadastro (conta, cliente): "" vira nulo. */
const optionalId = z
  .string()
  .nullable()
  .transform((value) => value || null);

export const expenseDataSchema = z.object({
  description: z.string().trim().min(2, "Descreva a despesa.").max(120, "Use no máximo 120 caracteres."),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: moneyAmount,
  date: z.iso.date("Data inválida."),
  supplier: optionalText(80),
  paymentMethod: optionalChoice(EXPENSE_PAYMENT_METHODS),
  accountId: optionalId,
  notes: optionalText(1000),
});

/** Mesmas regras da tabela revenues. */
export const revenueDataSchema = z.object({
  description: z.string().trim().min(2, "Descreva a receita.").max(120, "Use no máximo 120 caracteres."),
  category: z.enum(REVENUE_CATEGORIES),
  amount: moneyAmount,
  date: z.iso.date("Data inválida."),
  paymentMethod: optionalChoice(EXPENSE_PAYMENT_METHODS),
  customerId: optionalId,
  accountId: optionalId,
  notes: optionalText(1000),
});

// ---------------------------------------------------------------------------
// Login do painel
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(6, "A senha tem pelo menos 6 caracteres."),
});

export const passwordResetSchema = signInSchema.pick({ email: true });

export type PasswordResetInput = z.input<typeof passwordResetSchema>;

export const changePasswordSchema = z
  .object({
    /** Vazia só quando a pessoa entrou pelo link de redefinição. */
    currentPassword: z.string().default(""),
    password: z.string().min(8, "Use pelo menos 8 caracteres.").max(72, "Use no máximo 72 caracteres."),
    confirmation: z.string(),
  })
  .refine((data) => data.password === data.confirmation, {
    path: ["confirmation"],
    message: "As senhas não conferem.",
  })
  .refine((data) => data.password !== data.currentPassword, {
    path: ["password"],
    message: "A nova senha precisa ser diferente da atual.",
  });

export type ChangePasswordInput = z.input<typeof changePasswordSchema>;

export const profileSchema = z.object({
  name: personName,
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
});

export type ProfileInput = z.input<typeof profileSchema>;

// ---------------------------------------------------------------------------
// Configurações da loja (mesmas regras da tabela store_settings)
// ---------------------------------------------------------------------------

export const storeSettingsSchema = z.object({
  // Aceita null para que o dado já validado pela tela passe de novo pelo caso de uso.
  whatsappNumber: z
    .string()
    .nullable()
    .transform((value) => onlyDigits(value ?? ""))
    .refine((digits) => digits === "" || (digits.length >= 12 && digits.length <= 13), {
      message: "Use DDI + DDD + número, ex.: 55 11 91234-5678.",
    })
    .transform((digits) => digits || null),
  instagramHandle: z
    .string()
    .trim()
    .min(1, "Informe o @ do Instagram.")
    .transform((value) => (value.startsWith("@") ? value : `@${value}`))
    .pipe(z.string().regex(/^@[A-Za-z0-9._]{1,30}$/, "Use só letras, números, ponto e sublinhado.")),
  guaranteeDays: z
    .number({ message: "Informe um número de dias." })
    .int("Use um número inteiro.")
    .min(1, "A garantia precisa ter pelo menos 1 dia.")
    .max(90, "Use no máximo 90 dias."),
});

export type StoreSettingsInput = z.input<typeof storeSettingsSchema>;

// ---------------------------------------------------------------------------
// Textos do site (aba Site do painel)
// ---------------------------------------------------------------------------

/** Texto obrigatório do site: sem espaço sobrando nas pontas e com limite para não quebrar o layout. */
const copy = (max: number) =>
  z.string().trim().min(1, "Não deixe em branco.").max(max, `Use no máximo ${max} caracteres.`);

const copyList = (min: number, max: number, itemMax: number) =>
  z
    .array(copy(itemMax))
    .min(min, `Mantenha pelo menos ${min}.`)
    .max(max, `Use no máximo ${max}.`);

const textCard = z.object({ title: copy(60), text: copy(220) });

const siteImage = z.object({
  url: z.string().min(1, "Envie a imagem.").refine(fitsImageLimit, IMAGE_TOO_LONG),
  alt: copy(240),
});

const titleBlock = { eyebrow: copy(40), title: copy(90), description: copy(240) };

export const siteContentSchema = z.object({
  seo: z.object({ title: copy(70), description: copy(170) }),
  hero: z.object({
    badge: copy(60),
    title: copy(60),
    titleHighlight: z.string().trim().max(40, "Use no máximo 40 caracteres."),
    subtitle: copy(260),
    primaryCta: copy(32),
    secondaryCta: copy(32),
    proofPoints: z.tuple([copy(40), copy(40), copy(40)]),
    phoneName: copy(30),
    phoneHandle: copy(30),
    chipTitle: copy(24),
    chipText: copy(32),
    statLabel: copy(40),
    statValue: copy(10),
  }),
  problem: z.object({
    eyebrow: copy(40),
    title: copy(60),
    titleMuted: z.string().trim().max(60, "Use no máximo 60 caracteres."),
    description: copy(240),
    fromScratchTitle: copy(50),
    fromScratch: copyList(1, 6, 90),
    fromScratchImage: siteImage,
    withUsTitle: copy(50),
    withUs: copyList(1, 6, 90),
    withUsImage: siteImage,
  }),
  featured: z.object({ ...titleBlock, allButton: copy(24) }),
  howItWorks: z.object({ eyebrow: copy(40), title: copy(90), steps: z.tuple([textCard, textCard, textCard, textCard]) }),
  results: z.object({ ...titleBlock, disclaimer: copy(400) }),
  guarantee: z.object({ ...titleBlock, items: z.tuple([textCard, textCard, textCard, textCard]) }),
  faq: z.object({
    ...titleBlock,
    items: z
      .array(z.object({ question: copy(120), answer: copy(600), tiktokOnly: z.boolean() }))
      .min(1, "Mantenha pelo menos uma pergunta.")
      .max(20, "Use no máximo 20 perguntas."),
  }),
  finalCta: z.object({ titleLine1: copy(50), titleLine2: z.string().trim().max(50, "Use no máximo 50 caracteres."), button: copy(32) }),
  footer: z.object({ tagline: copy(160), slogan: z.string().trim().max(120, "Use no máximo 120 caracteres."), disclaimer: copy(200) }),
  whatsapp: z.object({ teaserTitle: copy(40), teaserText: copy(50) }),
  terms: z.object({
    eyebrow: copy(30),
    title: copy(80),
    sections: z
      .array(z.object({ title: copy(80), body: copy(2000) }))
      .min(1, "Mantenha pelo menos uma seção.")
      .max(20, "Use no máximo 20 seções."),
  }),
});

export class ValidationError extends Error {
  constructor(
    message: string,
    readonly fieldErrors: Record<string, string>,
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

/** Erros do zod viram um mapa `campo -> mensagem`, com o caminho em pontos (ex.: `stats.views`). */
export function fieldErrorsOf(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export function parseOrThrow<T>(schema: z.ZodType<T>, raw: unknown): T {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  const fieldErrors = fieldErrorsOf(result.error);
  throw new ValidationError(Object.values(fieldErrors)[0] ?? "Dados inválidos.", fieldErrors);
}
