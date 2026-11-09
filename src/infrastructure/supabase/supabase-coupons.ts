import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminCouponRepository, CouponService } from "@/application/ports";
import {
  COUPON_KINDS,
  COUPON_REJECTION_MESSAGE,
  couponRejectionOf,
  type Coupon,
  type CouponData,
  type CouponPreview,
} from "@/domain/coupon";
import { CouponCodeTakenError, CouponNotFoundError, CouponRejectedError } from "@/domain/errors";
import { fail } from "./supabase-repositories";

const UNIQUE_VIOLATION = "23505";
// `coupon_uses` é a coluna calculada no banco: pedidos com o cupom que não foram cancelados.
const COUPON_COLUMNS = "id, code, kind, value, active, starts_at, ends_at, max_uses, notes, created_at, uses:coupon_uses";

const couponRowSchema = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.enum(COUPON_KINDS),
  value: z.number(),
  active: z.boolean(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  max_uses: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
  uses: z.number(),
});

function toCoupon(raw: unknown): Coupon {
  const row = couponRowSchema.parse(raw);
  return {
    id: row.id,
    code: row.code,
    kind: row.kind,
    value: row.value,
    active: row.active,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxUses: row.max_uses,
    notes: row.notes,
    createdAt: row.created_at,
    uses: row.uses,
  };
}

const toCouponRow = (data: CouponData) => ({
  code: data.code,
  kind: data.kind,
  value: data.value,
  active: data.active,
  starts_at: data.startsAt,
  ends_at: data.endsAt,
  max_uses: data.maxUses,
  notes: data.notes,
});

function failOnCouponWrite(error: PostgrestError, code: string): never {
  if (error.code === UNIQUE_VIOLATION) throw new CouponCodeTakenError(code);
  return fail(error);
}

export class SupabaseCouponRepository implements AdminCouponRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<Coupon[]> {
    const { data, error } = await this.client.from("coupons").select(COUPON_COLUMNS).order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toCoupon);
  }

  async findById(id: string): Promise<Coupon | null> {
    const { data, error } = await this.client.from("coupons").select(COUPON_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toCoupon(data) : null;
  }

  async create(input: CouponData): Promise<Coupon> {
    const { data, error } = await this.client.from("coupons").insert(toCouponRow(input)).select(COUPON_COLUMNS).single();
    if (error) failOnCouponWrite(error, input.code);
    return toCoupon(data);
  }

  async update(id: string, input: CouponData): Promise<Coupon> {
    const { data, error } = await this.client.from("coupons").update(toCouponRow(input)).eq("id", id).select(COUPON_COLUMNS).maybeSingle();
    if (error) failOnCouponWrite(error, input.code);
    if (!data) throw new CouponNotFoundError();
    return toCoupon(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("coupons").delete().eq("id", id);
    if (error) fail(error);
  }
}

const previewSchema = z.union([
  z.object({ error: z.string() }),
  z.object({ code: z.string(), discount_cents: z.number(), total_cents: z.number() }),
]);

/** Prévia pública do checkout (`preview_coupon`), limitada por visitante no banco. */
export class SupabaseCouponService implements CouponService {
  constructor(private readonly client: SupabaseClient) {}

  async preview(code: string, accountId: string): Promise<CouponPreview> {
    const { data, error } = await this.client.rpc("preview_coupon", { p_code: code, p_account_id: accountId });
    if (error) fail(error);
    const result = previewSchema.parse(data);
    if ("error" in result) {
      const reason = couponRejectionOf(result.error) ?? "coupon_not_found";
      throw new CouponRejectedError(reason, COUPON_REJECTION_MESSAGE[reason]);
    }
    return { code: result.code, discount: result.discount_cents, total: result.total_cents };
  }
}
