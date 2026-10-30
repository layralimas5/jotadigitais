import { useEffect, useState } from "react";
import { container } from "@/app/container";
import { checkPixPayment, startPixPayment } from "@/application/use-cases";
import type { OrderPayment } from "@/domain/payment";

const { store } = container;

/** Com o QR Code na tela, confere no C6 a cada poucos segundos: o cliente vê "Pago" logo depois de pagar. */
const CHECK_MS = 5_000;

export type PixCharge = { status: "loading" } | { status: "ready"; c6Code: string | null };

/**
 * Cobrança Pix do C6 para uma parte do pedido. `c6Code` null quer dizer que o C6 não respondeu:
 * a tela usa o QR Code da chave Nubank e o Jota confirma no painel.
 */
export function usePixCharge(orderCode: string, payment: Pick<OrderPayment, "id" | "pixCode">, onPaid: () => void): PixCharge {
  const [charge, setCharge] = useState<PixCharge>(() =>
    payment.pixCode ? { status: "ready", c6Code: payment.pixCode } : { status: "loading" },
  );
  const needsCharge = charge.status === "loading";
  const c6Code = charge.status === "ready" ? charge.c6Code : null;

  useEffect(() => {
    if (!needsCharge) return;
    let active = true;
    startPixPayment(store, orderCode, payment.id)
      .catch((reason: unknown) => {
        console.error("Falha ao criar a cobrança Pix", reason);
        return null;
      })
      .then((code) => {
        if (active) setCharge({ status: "ready", c6Code: code });
      });
    return () => {
      active = false;
    };
  }, [needsCharge, orderCode, payment.id]);

  useEffect(() => {
    if (!c6Code) return;
    let checking = false;
    const timer = window.setInterval(() => {
      if (checking || document.visibilityState !== "visible") return;
      checking = true;
      checkPixPayment(store, orderCode, payment.id)
        .then((paid) => {
          if (paid) onPaid();
        })
        .catch((reason: unknown) => console.error("Falha ao conferir o Pix", reason))
        .finally(() => {
          checking = false;
        });
    }, CHECK_MS);
    return () => window.clearInterval(timer);
  }, [c6Code, orderCode, payment.id, onPaid]);

  return charge;
}
