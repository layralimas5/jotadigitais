import { useState, type FormEvent } from "react";
import type { z } from "zod";
import { checkoutProfileSchema, checkoutSchema, type CheckoutData, type CheckoutInput } from "@/application/schemas";

export type CheckoutValues = Omit<CheckoutInput, "acceptedTerms" | "instagram"> & { acceptedTerms: boolean; instagram: string };
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
  paymentMethod: "pix",
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
];
const PAYMENT_FIELDS: CheckoutField[] = ["paymentMethod", "acceptedTerms"];

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

function validateAll(values: CheckoutValues): { data: CheckoutData | null; errors: FieldErrors } {
  const result = checkoutSchema.safeParse(values);
  return result.success ? { data: result.data, errors: {} } : { data: null, errors: errorsOf(result.error) };
}

function focusFirst(form: HTMLFormElement, fields: readonly CheckoutField[], errors: FieldErrors) {
  const first = fields.find((field) => errors[field]);
  if (first) form.querySelector<HTMLElement>(`[name="${first}"]`)?.focus();
}

/**
 * Checkout em dois passos com validação zod: a ficha é conferida antes do pagamento,
 * e depois do primeiro erro cada campo é revalidado enquanto a pessoa corrige.
 */
export function useCheckoutForm(onValid: (data: CheckoutData) => void) {
  const [values, setValues] = useState<CheckoutValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<CheckoutStep>("profile");

  const revalidate = (next: CheckoutValues) => (step === "profile" ? validateProfile(next) : validateAll(next).errors);

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

    const result = validateAll(values);
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
