import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { matchesFilter, sortAccounts } from "@/application/catalog";
import type {
  AccountFilter,
  AccountRepository,
  AdminAccountRepository,
  AdminOrderRepository,
  AdminTestimonialRepository,
  NewOrder,
  OrderRepository,
  TestimonialRepository,
} from "@/application/ports";
import type { Account, AccountData } from "@/domain/account";
import {
  AccountNotFoundError,
  AccountUnavailableError,
  InvalidTransitionError,
  SlugTakenError,
  TooManyOpenOrdersError,
} from "@/domain/errors";
import { RESERVATION_HOLD_MINUTES, type Order, type OrderStatus } from "@/domain/order";
import type { Testimonial, TestimonialData } from "@/domain/testimonial";
import {
  ACCOUNT_COLUMNS,
  ORDER_COLUMNS,
  TESTIMONIAL_COLUMNS,
  toAccount,
  toAccountRow,
  toOrder,
  toTestimonial,
  toTestimonialRow,
} from "./rows";

const UNIQUE_VIOLATION = "23505";

/** Erro do PostgREST com a mensagem original no log e uma mensagem legível para a tela. */
export class BackendError extends Error {
  constructor(
    readonly cause: PostgrestError,
    message = "Não foi possível falar com o servidor. Tente de novo em instantes.",
  ) {
    super(message);
    this.name = "BackendError";
  }
}

function fail(error: PostgrestError): never {
  console.error(error);
  throw new BackendError(error);
}

/** Erros de regra que as funções do banco levantam com `raise exception '<código>'`. */
function failFromRpc(error: PostgrestError): never {
  if (error.message.includes("account_unavailable")) throw new AccountUnavailableError();
  if (error.message.includes("account_not_found")) throw new AccountNotFoundError("");
  if (error.message.includes("too_many_open_orders")) throw new TooManyOpenOrdersError();
  if (error.message.includes("invalid_transition")) throw new InvalidTransitionError();
  return fail(error);
}

/** Caracteres que quebram a sintaxe de filtro do PostgREST (`or=(...)`). */
function sanitizeQuery(query: string): string {
  return query.replace(/[,()*%\\]/g, " ").trim();
}

export class SupabaseAccountRepository implements AccountRepository, AdminAccountRepository {
  constructor(private readonly client: SupabaseClient) {}

  /**
   * Rede, faixa de seguidores e busca vão para o banco. Disponibilidade e ordenação são resolvidas aqui,
   * porque reserva vencida conta como disponível (ver `effectiveStatus`).
   */
  async list(filter: AccountFilter): Promise<Account[]> {
    let request = this.client.from("accounts").select(ACCOUNT_COLUMNS);
    if (filter.platform) request = request.eq("platform", filter.platform);
    if (filter.minFollowers !== undefined) request = request.gte("followers", filter.minFollowers);
    if (filter.maxFollowers !== undefined) request = request.lt("followers", filter.maxFollowers);
    if (filter.onlyAvailable) request = request.neq("status", "sold");
    const query = filter.query ? sanitizeQuery(filter.query) : "";
    if (query) request = request.or(`display_name.ilike.%${query}%,handle.ilike.%${query}%,niche.ilike.%${query}%`);

    const { data, error } = await request.order("listed_at", { ascending: false });
    if (error) fail(error);
    const accounts = data.map(toAccount).filter((account) => matchesFilter(account, { ...filter, query: undefined }));
    return sortAccounts(accounts, filter.sort);
  }

  async findBySlug(slug: string): Promise<Account | null> {
    const { data, error } = await this.client.from("accounts").select(ACCOUNT_COLUMNS).eq("slug", slug).maybeSingle();
    if (error) fail(error);
    return data ? toAccount(data) : null;
  }

  async findById(id: string): Promise<Account | null> {
    const { data, error } = await this.client.from("accounts").select(ACCOUNT_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toAccount(data) : null;
  }

  async listAll(): Promise<Account[]> {
    const { data, error } = await this.client
      .from("accounts")
      .select(ACCOUNT_COLUMNS)
      .order("listed_at", { ascending: false });
    if (error) fail(error);
    return sortAccounts(data.map(toAccount), "recent");
  }

  async create(input: AccountData): Promise<Account> {
    const { data, error } = await this.client.from("accounts").insert(toAccountRow(input)).select(ACCOUNT_COLUMNS).single();
    if (error) this.failOnWrite(error, input.slug);
    return toAccount(data);
  }

  async update(id: string, input: AccountData): Promise<Account> {
    const { data, error } = await this.client
      .from("accounts")
      .update(toAccountRow(input))
      .eq("id", id)
      .select(ACCOUNT_COLUMNS)
      .single();
    if (error) this.failOnWrite(error, input.slug);
    return toAccount(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("accounts").delete().eq("id", id);
    if (error) fail(error);
  }

  private failOnWrite(error: PostgrestError, slug: string): never {
    if (error.code === UNIQUE_VIOLATION) throw new SlugTakenError(slug);
    return fail(error);
  }
}

export class SupabaseTestimonialRepository implements TestimonialRepository, AdminTestimonialRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listPublished(): Promise<Testimonial[]> {
    const { data, error } = await this.client
      .from("testimonials")
      .select(TESTIMONIAL_COLUMNS)
      .eq("published", true)
      .order("position");
    if (error) fail(error);
    return data.map(toTestimonial);
  }

  async listAll(): Promise<Testimonial[]> {
    const { data, error } = await this.client.from("testimonials").select(TESTIMONIAL_COLUMNS).order("position");
    if (error) fail(error);
    return data.map(toTestimonial);
  }

  async findById(id: string): Promise<Testimonial | null> {
    const { data, error } = await this.client.from("testimonials").select(TESTIMONIAL_COLUMNS).eq("id", id).maybeSingle();
    if (error) fail(error);
    return data ? toTestimonial(data) : null;
  }

  async create(input: TestimonialData): Promise<Testimonial> {
    const last = await this.client
      .from("testimonials")
      .select("position")
      .order("position", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (last.error) fail(last.error);
    const position = typeof last.data?.position === "number" ? last.data.position + 1 : 0;

    const { data, error } = await this.client
      .from("testimonials")
      .insert({ ...toTestimonialRow(input), position })
      .select(TESTIMONIAL_COLUMNS)
      .single();
    if (error) fail(error);
    return toTestimonial(data);
  }

  async update(id: string, input: TestimonialData): Promise<Testimonial> {
    const { data, error } = await this.client
      .from("testimonials")
      .update(toTestimonialRow(input))
      .eq("id", id)
      .select(TESTIMONIAL_COLUMNS)
      .single();
    if (error) fail(error);
    return toTestimonial(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("testimonials").delete().eq("id", id);
    if (error) fail(error);
  }

  async reorder(ids: string[]): Promise<void> {
    const results = await Promise.all(
      ids.map((id, position) => this.client.from("testimonials").update({ position }).eq("id", id)),
    );
    const failed = results.find((result) => result.error);
    if (failed?.error) fail(failed.error);
  }
}

export class SupabaseOrderRepository implements OrderRepository, AdminOrderRepository {
  constructor(private readonly client: SupabaseClient) {}

  async place(input: NewOrder): Promise<Order> {
    const { data, error } = await this.client.rpc("place_order", {
      p_account_id: input.accountId,
      p_name: input.customer.name,
      p_email: input.customer.email,
      p_whatsapp: input.customer.whatsapp ?? "",
      p_payment_method: input.paymentMethod,
      p_hold_minutes: RESERVATION_HOLD_MINUTES,
    });
    if (error) failFromRpc(error);
    return toOrder(data);
  }

  async findByCode(code: string): Promise<Order | null> {
    const { data, error } = await this.client.rpc("get_order", { p_code: code });
    if (error) fail(error);
    return data ? toOrder(data) : null;
  }

  async listAll(): Promise<Order[]> {
    const { data, error } = await this.client
      .from("orders")
      .select(ORDER_COLUMNS)
      .order("created_at", { ascending: false });
    if (error) fail(error);
    return data.map(toOrder);
  }

  async updateStatus(code: string, status: OrderStatus): Promise<void> {
    const { error } = await this.client.from("orders").update({ status }).eq("code", code);
    if (error) failFromRpc(error);
  }
}
