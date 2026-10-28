import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { checkoutSchema, fieldErrorsOf, type CheckoutData, type CheckoutInput } from "@/application/schemas";
import type { LeadSource } from "@/domain/lead";
import { formatCentsInput, parseMoneyToCents, type Cents } from "@/domain/money";
import { checkSplit, type PaymentPlan } from "@/domain/payment";

/** Primeiro nível da escolha: Pix, um cartão ou dividir em duas partes. */
export type PaymentChoice = "pix" | "card" | "split";
export type SplitKind = Extract<PaymentPlan, "two_cards" | "card_pix">;

export type CheckoutValues = Omit<CheckoutInput, "acceptedTerms" | "source" | "referredBy" | "paymentMethod" | "firstPartCents"> & {
  acceptedTerms: boolean;
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

const INITIAL_VALUES: CheckoutValues = {
  name: "",
  whatsapp: "",
  document: "",
  source: "",
  referredBy: "",
  paymentChoice: "",
  splitKind: "two_cards",
  firstPart: "",
  acceptedTerms: false,
};

/** Ordem dos campos na tela: o foco vai para o primeiro com erro. */
const FIELD_ORDER: CheckoutField[] = ["name", "whatsapp", "document", "source", "referredBy", "paymentChoice", "firstPart", "acceptedTerms"];

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

function validate(values: CheckoutValues, total: Cents): { data: CheckoutData | null; errors: FieldErrors } {
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

/** Checkout numa tela só com validação zod; depois da primeira tentativa, cada campo é revalidado enquanto a pessoa corrige. */
export function useCheckoutForm(total: Cents, onValid: (data: CheckoutData) => void) {
  const [values, setValues] = useState<CheckoutValues>(() => ({ ...INITIAL_VALUES, firstPart: halfOf(total) }));
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const setField = <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validate(next, total).errors);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const result = validate(values, total);
    setErrors(result.errors);
    if (result.data) {
      onValid(result.data);
      return;
    }
    const first = FIELD_ORDER.find((field) => result.errors[field]);
    if (first) event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
  };

  return { values, errors, setField, handleSubmit };
}
