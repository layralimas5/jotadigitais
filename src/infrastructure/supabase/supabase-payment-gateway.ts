import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import type { CardPaymentReturn, PaymentGateway } from "@/application/ports";

const FUNCTION = "infinitepay";
const PIX_FUNCTION = "c6-pix";

/** Mensagem para o cliente a partir do código de erro da Edge Function infinitepay. */
const ERROR_MESSAGE: Record<string, string> = {
  unavailable: "Esse pagamento não está mais aberto. O pedido pode ter vencido ou já estar pago.",
  not_found: "Não achamos esse pagamento. Abra o pedido pelo link do e-mail.",
  gateway: "A InfinitePay não respondeu agora. Tente de novo em instantes.",
};

const FALLBACK = "Não foi possível abrir o pagamento no cartão. Tente de novo ou fale com o suporte.";

async function errorCodeOf(error: unknown): Promise<string | null> {
  if (!(error instanceof FunctionsHttpError)) return null;
  try {
    const body = (await error.context.json()) as { error?: unknown };
    return typeof body.error === "string" ? body.error : null;
  } catch {
    return null;
  }
}

/** Cartão pela InfinitePay e Pix pelo C6, sempre pelas Edge Functions: o navegador nunca fala direto com as APIs. */
export class SupabasePaymentGateway implements PaymentGateway {
  constructor(private readonly client: SupabaseClient) {}

  async cardCheckoutUrl(orderCode: string, paymentId: string): Promise<string> {
    const { data, error } = await this.client.functions.invoke<{ url?: string }>(FUNCTION, {
      body: { action: "checkout", code: orderCode, paymentId },
    });
    if (error) {
      const code = await errorCodeOf(error);
      console.error("Falha ao abrir o checkout de cartão", code ?? error);
      throw new Error((code && ERROR_MESSAGE[code]) ?? FALLBACK);
    }
    if (!data?.url) throw new Error(FALLBACK);
    return data.url;
  }

  async confirmCardReturn(payment: CardPaymentReturn): Promise<boolean> {
    const { data, error } = await this.client.functions.invoke<{ paid?: boolean }>(FUNCTION, {
      body: { action: "confirm", ...payment },
    });
    if (error) {
      // 402: a InfinitePay ainda não deu como pago. O webhook confirma depois, sem o cliente fazer nada.
      if ((await errorCodeOf(error)) === "not_paid") return false;
      console.error("Falha ao conferir o pagamento no cartão", error);
      return false;
    }
    return data?.paid === true;
  }

  async pixChargeCode(orderCode: string, paymentId: string): Promise<string | null> {
    const { data, error } = await this.client.functions.invoke<{ pixCode?: string }>(PIX_FUNCTION, {
      body: { action: "charge", code: orderCode, paymentId },
    });
    if (error) {
      // C6 fora do ar ou ainda sem certificado: o site cai para o QR Code da chave Nubank.
      console.error("Cobrança Pix do C6 indisponível", (await errorCodeOf(error)) ?? error);
      return null;
    }
    return data?.pixCode ?? null;
  }

  async checkPixPayment(orderCode: string, paymentId: string): Promise<boolean> {
    const { data, error } = await this.client.functions.invoke<{ paid?: boolean }>(PIX_FUNCTION, {
      body: { action: "check", code: orderCode, paymentId },
    });
    if (error) {
      console.error("Falha ao conferir o Pix no C6", (await errorCodeOf(error)) ?? error);
      return false;
    }
    return data?.paid === true;
  }
}
