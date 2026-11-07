import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AccessRepository } from "@/application/ports";
import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import { ADMIN_USERS_FUNCTION, fail, failFromFunction } from "./supabase-repositories";

const accessRowSchema = z.object({
  user_id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  role: z.enum(["admin", "developer"]),
  whatsapp: z.string().nullable(),
  created_at: z.string(),
  last_sign_in_at: z.string().nullable(),
  mfa_enabled: z.boolean(),
  active_sessions: z.coerce.number(),
});

function toAccessUser(raw: unknown): AccessUser {
  const row = accessRowSchema.parse(raw);
  return {
    id: row.user_id,
    name: row.name,
    email: row.email,
    role: row.role,
    whatsapp: row.whatsapp,
    createdAt: row.created_at,
    lastSignInAt: row.last_sign_in_at,
    mfaEnabled: row.mfa_enabled,
    activeSessions: row.active_sessions,
  };
}

/** Lista e sessões pelo banco (funções só da desenvolvedora); e-mail, senha e duas etapas pela Edge Function. */
export class SupabaseAccessRepository implements AccessRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<AccessUser[]> {
    const { data, error } = await this.client.rpc("list_access_users");
    if (error) fail(error);
    return z.array(z.unknown()).parse(data).map(toAccessUser);
  }

  async updateProfile(userId: string, update: AccessProfileUpdate): Promise<void> {
    await this.invoke({ action: "update_profile", userId, ...update }, update.email);
  }

  async setPassword(userId: string, password: string): Promise<void> {
    await this.invoke({ action: "set_password", userId, password });
  }

  async endSessions(userId: string): Promise<void> {
    const { error } = await this.client.rpc("end_user_sessions", { p_user_id: userId });
    if (error) fail(error);
  }

  async resetMfa(userId: string): Promise<void> {
    await this.invoke({ action: "reset_mfa", userId });
  }

  private async invoke(body: Record<string, unknown>, email?: string): Promise<void> {
    const { error } = await this.client.functions.invoke(ADMIN_USERS_FUNCTION, { body });
    if (error) await failFromFunction(error, email);
  }
}
