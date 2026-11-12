import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminDeliveryMessageRepository, AdminProfileLoginRepository } from "@/application/ports";
import type { ProfileLogin } from "@/domain/delivery-login";
import type { DeliveryMessage, DeliveryMessageData } from "@/domain/delivery-message";
import { DeliveryMessageNotFoundError } from "@/domain/errors";
import { fail } from "./supabase-repositories";

const DELIVERY_MESSAGE_COLUMNS = "id, name, body, created_at, updated_at";

const deliveryMessageRowSchema = z.object({
  id: z.string(),
  name: z.string(),
  body: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

function toDeliveryMessage(raw: unknown): DeliveryMessage {
  const row = deliveryMessageRowSchema.parse(raw);
  return { id: row.id, name: row.name, body: row.body, createdAt: row.created_at, updatedAt: row.updated_at };
}

export class SupabaseDeliveryMessageRepository implements AdminDeliveryMessageRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<DeliveryMessage[]> {
    const { data, error } = await this.client.from("delivery_messages").select(DELIVERY_MESSAGE_COLUMNS).order("created_at");
    if (error) fail(error);
    return data.map(toDeliveryMessage);
  }

  async create(input: DeliveryMessageData): Promise<DeliveryMessage> {
    const { data, error } = await this.client.from("delivery_messages").insert(input).select(DELIVERY_MESSAGE_COLUMNS).single();
    if (error) fail(error);
    return toDeliveryMessage(data);
  }

  async update(id: string, input: DeliveryMessageData): Promise<DeliveryMessage> {
    const { data, error } = await this.client.from("delivery_messages").update(input).eq("id", id).select(DELIVERY_MESSAGE_COLUMNS).maybeSingle();
    if (error) fail(error);
    if (!data) throw new DeliveryMessageNotFoundError();
    return toDeliveryMessage(data);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("delivery_messages").delete().eq("id", id);
    if (error) fail(error);
  }
}

/** A senha só sai aberta pela coluna calculada; quem não pode ver recebe nula. */
const PROFILE_LOGIN_COLUMNS = "username, password:profile_password_plain";

const profileLoginRowSchema = z.object({ username: z.string().nullable(), password: z.string().nullable() });

const toProfileLogin = (raw: unknown): ProfileLogin => profileLoginRowSchema.parse(raw);

export class SupabaseProfileLoginRepository implements AdminProfileLoginRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findByAccountId(accountId: string): Promise<ProfileLogin | null> {
    const { data, error } = await this.client.from("account_profile_logins").select(PROFILE_LOGIN_COLUMNS).eq("account_id", accountId).maybeSingle();
    if (error) fail(error);
    return data ? toProfileLogin(data) : null;
  }

  async save(accountId: string, login: ProfileLogin): Promise<ProfileLogin> {
    const { data, error } = await this.client
      .from("account_profile_logins")
      .upsert({ account_id: accountId, username: login.username, password: login.password }, { onConflict: "account_id" })
      .select(PROFILE_LOGIN_COLUMNS)
      .single();
    if (error) fail(error);
    return toProfileLogin(data);
  }

  async remove(accountId: string): Promise<void> {
    const { error } = await this.client.from("account_profile_logins").delete().eq("account_id", accountId);
    if (error) fail(error);
  }
}
