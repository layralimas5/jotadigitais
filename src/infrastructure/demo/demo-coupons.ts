import type { AdminCouponRepository, CouponService } from "@/application/ports";
import { effectiveStatus, isPurchasable } from "@/domain/account";
import {
  COUPON_REJECTION_MESSAGE,
  couponDiscount,
  couponStatusOf,
  normalizeCouponCode,
  type Coupon,
  type CouponData,
  type CouponPreview,
  type CouponRejection,
  type CouponStatus,
} from "@/domain/coupon";
import { CouponCodeTakenError, CouponNotFoundError, CouponRejectedError } from "@/domain/errors";
import type { Order } from "@/domain/order";
import { newId, simulateLatency, type DemoDatabase, type DemoState } from "./demo-database";

/** No navegador o cupom fica sem a contagem de usos: ela sai dos pedidos, como no banco. */
export type StoredCoupon = Omit<Coupon, "uses">;

const usesOf = (orders: readonly Order[], code: string) => orders.filter((order) => order.couponCode === code && order.status !== "canceled").length;

const withUses = (coupon: StoredCoupon, orders: readonly Order[]): Coupon => ({ ...coupon, uses: usesOf(orders, coupon.code) });

const REJECTION_BY_STATUS: Record<Exclude<CouponStatus, "active">, CouponRejection> = {
  inactive: "coupon_inactive",
  scheduled: "coupon_not_started",
  expired: "coupon_expired",
  exhausted: "coupon_exhausted",
};

const reject = (reason: CouponRejection): never => {
  throw new CouponRejectedError(reason, COUPON_REJECTION_MESSAGE[reason]);
};

/** Espelha `coupon_discount` do banco: confere o cupom e devolve o desconto para o preço. */
export function applyDemoCoupon(state: DemoState, rawCode: string, price: number): { code: string; discount: number } {
  const code = normalizeCouponCode(rawCode);
  const stored = (state.coupons ?? []).find((item) => item.code === code);
  if (!stored) return reject("coupon_not_found");
  const status = couponStatusOf(withUses(stored, state.orders));
  if (status !== "active") return reject(REJECTION_BY_STATUS[status]);
  return { code, discount: couponDiscount(stored, price) };
}

export class DemoCouponRepository implements AdminCouponRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<Coupon[]> {
    const state = this.db.read();
    return (state.coupons ?? []).map((coupon) => withUses(coupon, state.orders)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async findById(id: string): Promise<Coupon | null> {
    const state = this.db.read();
    const stored = (state.coupons ?? []).find((item) => item.id === id);
    return stored ? withUses(stored, state.orders) : null;
  }

  async create(data: CouponData): Promise<Coupon> {
    await simulateLatency();
    return this.db.write((state) => {
      const all = state.coupons ?? [];
      if (all.some((item) => item.code === data.code)) throw new CouponCodeTakenError(data.code);
      const created: StoredCoupon = { ...data, id: newId("cpn"), createdAt: new Date().toISOString() };
      state.coupons = [...all, created];
      return withUses(created, state.orders);
    });
  }

  async update(id: string, data: CouponData): Promise<Coupon> {
    await simulateLatency();
    return this.db.write((state) => {
      const all = state.coupons ?? [];
      const current = all.find((item) => item.id === id);
      if (!current) throw new CouponNotFoundError();
      if (all.some((item) => item.id !== id && item.code === data.code)) throw new CouponCodeTakenError(data.code);
      const updated: StoredCoupon = { ...current, ...data };
      state.coupons = all.map((item) => (item.id === id ? updated : item));
      return withUses(updated, state.orders);
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.coupons = (state.coupons ?? []).filter((item) => item.id !== id);
    });
  }
}

export class DemoCouponService implements CouponService {
  constructor(private readonly db: DemoDatabase) {}

  async preview(code: string, accountId: string): Promise<CouponPreview> {
    await simulateLatency();
    const state = this.db.read();
    const account = state.accounts.find((item) => item.id === accountId);
    if (!account || !isPurchasable({ status: effectiveStatus(account.status, account.reservedUntil) })) return reject("account_unavailable");
    const applied = applyDemoCoupon(state, code, account.price);
    return { code: applied.code, discount: applied.discount, total: account.price - applied.discount };
  }
}
