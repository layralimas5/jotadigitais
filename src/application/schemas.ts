import { z } from "zod";

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
