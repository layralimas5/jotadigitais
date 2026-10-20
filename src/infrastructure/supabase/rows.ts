import { z } from "zod";
import { accountBaseSchema, platformStatsSchema, testimonialDataSchema } from "@/application/schemas";
import { ACCOUNT_STATUSES, effectiveStatus, type Account, type AccountData } from "@/domain/account";
import { BRAZIL_STATES } from "@/domain/brazil";
import { ORDER_STATUSES, PAYMENT_METHODS, type Order } from "@/domain/order";
import { PLATFORMS } from "@/domain/platform";
import { TESTIMONIAL_KINDS, type Testimonial, type TestimonialData } from "@/domain/testimonial";

// Linhas como o PostgREST devolve (snake_case). Tudo que vem do banco passa por aqui antes de virar domínio.

const accountRowSchema = z.object({
  id: z.string(),
  slug: z.string(),
  platform: z.enum(PLATFORMS),
  display_name: z.string(),
  handle: z.string(),
  niche: z.string().nullable(),
  followers: z.number(),
  price_cents: z.number(),
  status: z.enum(ACCOUNT_STATUSES),
  reserved_until: z.string().nullable(),
  description: z.string().nullable(),
  avatar_url: z.string().nullable(),
  images: z.array(z.string()),
  stats: z.unknown(),
  listed_at: z.string(),
  partner_id: z.string().nullable(),
  profile_url: z.string().nullable(),
  stats_synced_at: z.string().nullable(),
});

export const ACCOUNT_COLUMNS =
  "id, slug, platform, display_name, handle, niche, followers, price_cents, status, reserved_until, description, avatar_url, images, stats, listed_at, partner_id, profile_url, stats_synced_at";

export function toAccount(raw: unknown): Account {
  const row = accountRowSchema.parse(raw);
  const base = accountBaseSchema.parse({
    slug: row.slug,
    displayName: row.display_name,
    handle: row.handle,
    niche: row.niche,
    followers: row.followers,
    price: row.price_cents,
    status: effectiveStatus(row.status, row.reserved_until),
    description: row.description,
    avatarUrl: row.avatar_url,
    images: row.images,
    listedAt: row.listed_at,
    partnerId: row.partner_id,
    profileUrl: row.profile_url,
    statsSyncedAt: row.stats_synced_at ? new Date(row.stats_synced_at).toISOString() : null,
  });
  const platformStats = platformStatsSchema.parse({ platform: row.platform, stats: row.stats });
  return { ...base, ...platformStats, id: row.id, reservedUntil: row.reserved_until };
}

export function toAccountRow(data: AccountData) {
  return {
    slug: data.slug,
    platform: data.platform,
    display_name: data.displayName,
    handle: data.handle,
    niche: data.niche,
    followers: data.followers,
    price_cents: data.price,
    status: data.status,
    description: data.description,
    avatar_url: data.avatarUrl,
    images: data.images,
    stats: data.stats,
    listed_at: data.listedAt,
    partner_id: data.partnerId,
    profile_url: data.profileUrl,
    stats_synced_at: data.statsSyncedAt,
  };
}

const testimonialRowSchema = z.object({
  id: z.string(),
  kind: z.enum(TESTIMONIAL_KINDS),
  title: z.string(),
  subtitle: z.string(),
  image_url: z.string(),
  image_alt: z.string(),
  width: z.number(),
  height: z.number(),
  position: z.number(),
  published: z.boolean(),
});

export const TESTIMONIAL_COLUMNS = "id, kind, title, subtitle, image_url, image_alt, width, height, position, published";

export function toTestimonial(raw: unknown): Testimonial {
  const row = testimonialRowSchema.parse(raw);
  const data = testimonialDataSchema.parse({
    kind: row.kind,
    title: row.title,
    subtitle: row.subtitle,
    imageUrl: row.image_url,
    imageAlt: row.image_alt,
    width: row.width,
    height: row.height,
    published: row.published,
  });
  return { ...data, id: row.id, position: row.position };
}

export function toTestimonialRow(data: TestimonialData) {
  return {
    kind: data.kind,
    title: data.title,
    subtitle: data.subtitle,
    image_url: data.imageUrl,
    image_alt: data.imageAlt,
    width: data.width,
    height: data.height,
    published: data.published,
  };
}

const orderRowSchema = z.object({
  code: z.string(),
  account_id: z.string().nullable(),
  account_handle: z.string(),
  account_name: z.string(),
  account_platform: z.enum(PLATFORMS),
  customer_name: z.string(),
  customer_email: z.string(),
  customer_whatsapp: z.string().nullable(),
  // Ficha do checkout: só o painel lê; a página pública do pedido e os pedidos antigos vêm sem ela.
  customer_document: z.string().nullish(),
  customer_birth_date: z.string().nullish(),
  customer_instagram: z.string().nullish(),
  customer_city: z.string().nullish(),
  customer_state: z.enum(BRAZIL_STATES).nullish(),
  payment_method: z.enum(PAYMENT_METHODS),
  total_cents: z.number(),
  status: z.enum(ORDER_STATUSES),
  expires_at: z.string(),
  created_at: z.string(),
  // A página pública do pedido (`get_order`) não devolve a data de entrega.
  delivered_at: z.string().nullish(),
});

export const ORDER_COLUMNS =
  "code, account_id, account_handle, account_name, account_platform, customer_name, customer_email, customer_whatsapp, customer_document, customer_birth_date, customer_instagram, customer_city, customer_state, payment_method, total_cents, status, expires_at, created_at, delivered_at";

export function toOrder(raw: unknown): Order {
  const row = orderRowSchema.parse(raw);
  return {
    code: row.code,
    accountId: row.account_id,
    accountHandle: row.account_handle,
    accountName: row.account_name,
    accountPlatform: row.account_platform,
    customer: {
      name: row.customer_name,
      email: row.customer_email,
      whatsapp: row.customer_whatsapp,
      document: row.customer_document ?? null,
      birthDate: row.customer_birth_date ?? null,
      instagram: row.customer_instagram ?? null,
      city: row.customer_city ?? null,
      state: row.customer_state ?? null,
    },
    paymentMethod: row.payment_method,
    total: row.total_cents,
    status: row.status,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    deliveredAt: row.delivered_at ?? null,
  };
}
