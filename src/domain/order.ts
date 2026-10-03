import type { Cents } from "./money";

export type PaymentMethod = "pix" | "card";

export type OrderStatus = "awaiting_payment" | "paid" | "delivered" | "canceled";

export interface Customer {
  name: string;
  email: string;
  whatsapp: string | null;
}

export interface Order {
  code: string;
  accountId: string;
  accountHandle: string;
  customer: Customer;
  paymentMethod: PaymentMethod;
  total: Cents;
  status: OrderStatus;
  createdAt: string;
}

export const MAX_CARD_INSTALLMENTS = 12;

export function generateOrderCode(random: () => number = Math.random): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chars = Array.from({ length: 6 }, () => alphabet[Math.floor(random() * alphabet.length)]);
  return `JD-${chars.join("")}`;
}
