import { useState, type FormEvent } from "react";
import { checkoutSchema, type CheckoutData, type CheckoutInput } from "@/application/schemas";

export type CheckoutValues = Omit<CheckoutInput, "acceptedTerms"> & { acceptedTerms: boolean };
export type CheckoutField = keyof CheckoutValues;
type FieldErrors = Partial<Record<CheckoutField, string>>;

const INITIAL_VALUES: CheckoutValues = {
  name: "",
  email: "",
  emailConfirmation: "",
  whatsapp: "",
  paymentMethod: "pix",
  acceptedTerms: false,
};

const FIELD_ORDER: CheckoutField[] = ["name", "email", "emailConfirmation", "whatsapp", "paymentMethod", "acceptedTerms"];

export function formatWhatsapp(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Estado do formulário de checkout com validação zod no envio e revalidação campo a campo depois do primeiro erro. */
export function useCheckoutForm(onValid: (data: CheckoutData) => void) {
  const [values, setValues] = useState<CheckoutValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);

  const validate = (next: CheckoutValues) => {
    const result = checkoutSchema.safeParse(next);
    if (result.success) return { data: result.data, errors: {} as FieldErrors };
    const fieldErrors: FieldErrors = {};
    for (const issue of result.error.issues) {
      const field = issue.path[0] as CheckoutField | undefined;
      if (field && !fieldErrors[field]) fieldErrors[field] = issue.message;
    }
    return { data: null, errors: fieldErrors };
  };

  const setField = <K extends CheckoutField>(field: K, value: CheckoutValues[K]) => {
    const next = { ...values, [field]: value };
    setValues(next);
    if (submitted) setErrors(validate(next).errors);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    const result = validate(values);
    setErrors(result.errors);
    if (result.data) {
      onValid(result.data);
      return;
    }
    const firstInvalid = FIELD_ORDER.find((field) => result.errors[field]);
    if (firstInvalid) event.currentTarget.querySelector<HTMLElement>(`[name="${firstInvalid}"]`)?.focus();
  };

  return { values, errors, setField, handleSubmit };
}
