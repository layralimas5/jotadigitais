import { z } from "zod";
import { ACCOUNT_STATUSES } from "@/domain/account";
import { TESTIMONIAL_KINDS } from "@/domain/testimonial";

const onlyDigits = (value: string) => value.replace(/\D/g, "");

export const checkoutSchema = z
  .object({
    name: z.string().trim().min(3, "Informe seu nome completo.").max(120, "Nome muito longo."),
    email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
    emailConfirmation: z.string().trim().toLowerCase(),
    whatsapp: z
      .string()
      .transform(onlyDigits)
      .refine((digits) => digits === "" || (digits.length >= 10 && digits.length <= 13), {
        message: "Número de WhatsApp inválido.",
      }),
    paymentMethod: z.enum(["pix", "card"], { message: "Escolha a forma de pagamento." }),
    acceptedTerms: z.literal(true, { message: "Você precisa aceitar os termos para continuar." }),
  })
  .refine((data) => data.email === data.emailConfirmation, {
    path: ["emailConfirmation"],
    message: "Os e-mails não conferem.",
  });

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
const imageUrl = z
  .string()
  .min(1, "Envie o print.")
  .refine((value) => value.startsWith("data:image/") || value.length <= 500, "Endereço de imagem longo demais.");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Use no máximo ${max} caracteres.`)
    .nullable()
    .transform((value) => (value ? value : null));

export const tiktokStatsSchema = z.object({ likes: count, following: count });
export const instagramStatsSchema = z.object({ posts: count, following: count, professional: z.boolean() });
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
  images: z.array(imageUrl).max(8, "Use no máximo 8 imagens."),
  listedAt: z.iso.date("Data inválida."),
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
// Login do painel
// ---------------------------------------------------------------------------

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Informe um e-mail válido.")),
  password: z.string().min(6, "A senha tem pelo menos 6 caracteres."),
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
