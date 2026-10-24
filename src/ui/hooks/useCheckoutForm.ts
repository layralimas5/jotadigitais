import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { checkoutProfileSchema, checkoutSchema, fieldErrorsOf, type CheckoutData, type CheckoutInput } from "@/application/schemas";
import type { LeadSource } from "@/domain/lead";
import { formatCentsInput, parseMoneyToCents, type Cents } from "@/domain/money";
import { checkSplit, type PaymentPlan } from "@/domain/payment";

/** Primeiro nível da escolha: Pix, um cartão ou dividir em duas partes. */
export type PaymentChoice = "pix" | "card" | "split";
export type SplitKind = Extract<PaymentPlan, "two_cards" | "card_pix">;

export type CheckoutValues = Omit<
  CheckoutInput,
  "acceptedTerms" | "instagram" | "source" | "referredBy" | "paymentMethod" | "firstPartCents"
> & {
  acceptedTerms: boolean;
  instagram: string;
  /** Vazio até a pessoa escolher. */
  source: LeadSource | "";
  referredBy: string;
  /** Vazio até a pessoa escolher: o Pix só aparece quando o Jota configurou a chave. */
  paymentChoice: PaymentChoice | "";
  splitKind: SplitKind;
  /** Valor do primeiro cartão, como a pessoa digitou ("185,00"). */
  firstPart: string;
};
export type CheckoutField = keyof CheckoutValues;
type FieldErrors = Partial<Record<CheckoutField, string>>;

/** Passo 1 é a ficha completa; o pagamento só aparece com ela válida. */
export type CheckoutStep = "profile" | "payment";

const INITIAL_VALUES: CheckoutValues = {
  name: "",
  document: "",
  birthDate: "",
  email: "",
  emailConfirmation: "",
  whatsapp: "",
  instagram: "",
  city: "",
  state: "" as CheckoutValues["state"],
  source: "",
  referredBy: "",
  paymentChoice: "",
  splitKind: "two_cards",
  firstPart: "",
  acceptedTerms: false,
};

const PROFILE_FIELDS: CheckoutField[] = [
  "name",
  "document",
  "birthDate",
  "email",
  "emailConfirmation",
  "whatsapp",
  "instagram",
  "city",
  "state",
  "source",
  "referredBy",
];
const PAYMENT_FIELDS: CheckoutField[] = ["paymentChoice", "firstPart", "acceptedTerms"];

export const planOf = (values: Pick<CheckoutValues, "paymentChoice" | "splitKind">): PaymentPlan | null =>
  values.paymentChoice === "split" ? values.splitKind : values.paymentChoice || null;

/** Metade do total, arredondada para reais inteiros: ponto de partida da divisão. */
export const halfOf = (total: Cents) => formatCentsInput(Math.round(total / 200) * 100);

export function formatWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function errorsOf(error: z.ZodError): FieldErrors {
  const fieldErrors: FieldErrors = {};
  for (const issue of error.issues) {
    const field = issue.path[0] as CheckoutField | undefined;
    if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
  }
  return fieldErrors;
}

function validateProfile(values: CheckoutValues): FieldErrors {
  const result = checkoutProfileSchema.safeParse(values);
  return result.success ? {} : errorsOf(result.error);
}

function validateAll(values: CheckoutValues, total: Cents): { data: CheckoutData | null; errors: FieldErrors } {
  const split = values.paymentChoice === "split";
  const firstPartCents = split ? parseMoneyToCents(values.firstPart) : null;
  const result = checkoutSchema.safeParse({
    ...values,
    paymentMethod: planOf(values),
    firstPartCents: Number.isNaN(firstPartCents) ? null : firstPartCents,
  });
  const errors: FieldErrors = result.success ? {} : errorsOf(result.error);
  // O schema fala em paymentMethod; na tela, o campo é a escolha (Pix, cartão ou dividir).
  const schemaErrors = result.success ? {} : (fieldErrorsOf(result.error) as Record<string, string | undefined>);
  if (schemaErrors.paymentMethod) errors.paymentChoice = schemaErrors.paymentMethod;
  if (split) {
    const check = checkSplit(total, Number.isNaN(firstPartCents) ? null : firstPartCents);
    if (!check.ok) errors.firstPart = check.message;
  }
  return result.success && !errors.firstPart ? { data: result.data, errors } : { data: null, errors };
}

function focusFirst(form: HTMLFormElement, fields: readonly CheckoutField[], errors: FieldErrors) {
  const first = fields.find((field) => errors[field]);
  if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
}

/**
 * Checkout em dois passos com validação zod: a ficha é conferida antes do pagamento,
 * e depois do primeiro erro cada campo é revalidado enquanto a pessoa corrige.
 */
export function useCheckoutForm(total: Cents, onValid: (data: CheckoutData) => void) {
  const [values, setValues] = useState<CheckoutValues>(() => ({ ...INITIAL_VALUES, firstPart: halfOf(total) }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("profile");

  const revalidate = (next: CheckoutValues) => (step === "profile" ? validateProfile(next) : validateAll(next, total).errors);

  const setField = <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(revalidate(next));
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const form = event.currentTarget;

    if (step === "profile") {
      const profileErrors = validateProfile(values);
      setErrors(profileErrors);
      if (Object.keys(profileErrors).length > 0) {
        focusFirst(form, PROFILE_FIELDS, profileErrors);
        return;
      }
      setSubmitted(false);
      setStep("payment");
      return;
    }

    const result = validateAll(values, total);
    setErrors(result.errors);
    if (result.data) {
      onValid(result.data);
      return;
    }
    // A ficha já passou, mas se algo mudou por fora volta para ela.
    if (PROFILE_FIELDS.some((field) => result.errors[field])) {
      setStep("profile");
      return;
    }
    focusFirst(form, PAYMENT_FIELDS, result.errors);
  };

  const editProfile = () => {
    setErrors({});
    setSubmitted(false);
    setStep("profile");
  };

  return { values, errors, step, setField, handleSubmit, editProfile };
}
