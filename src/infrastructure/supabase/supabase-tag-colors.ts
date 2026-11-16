import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminTagColorRepository } from "@/application/ports";
import type { TagColors } from "@/domain/tag-color";
import { fail } from "./supabase-repositories";

const rowSchema = z.object({ tag_key: z.string(), color: z.string() });

/** Tabela `account_tag_colors`: a vitrine lê; quem tem acesso a Contas grava. */
export class SupabaseTagColorRepository implements AdminTagColorRepository {
  constructor(private readonly client: SupabaseClient) {}

  async list(): Promise<TagColors> {
    const { data, error } = await this.client.from("account_tag_colors").select("tag_key, color");
    if (error) fail(error);
    return Object.fromEntries(z.array(rowSchema).parse(data).map((row) => [row.tag_key, row.color]));
  }

  async set(key: string, color: string | null): Promise<void> {
    const { error } =
      color === null
        ? await this.client.from("account_tag_colors").delete().eq("tag_key", key)
        : await this.client.from("account_tag_colors").upsert({ tag_key: key, color }, { onConflict: "tag_key" });
    if (error) fail(error);
  }
}
