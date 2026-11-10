import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { StorageUsageReader } from "@/application/ports";
import { SUPABASE_PLANS, type DatabaseUsage, type SupabasePlan } from "@/domain/storage";
import { fail } from "./supabase-repositories";

const usageSchema = z.object({
  database_bytes: z.coerce.number(),
  tables: z.array(z.object({ name: z.string(), bytes: z.coerce.number(), rows: z.coerce.number() })),
  buckets: z.array(z.object({ id: z.string(), public: z.boolean(), files: z.coerce.number(), bytes: z.coerce.number() })),
  measured_at: z.string(),
});

/** Uso do projeto Supabase pela função storage_usage (só tamanhos; só admin e desenvolvedora). */
export class SupabaseStorageUsageReader implements StorageUsageReader {
  readonly name = "Supabase";

  constructor(
    private readonly client: SupabaseClient,
    private readonly plan: SupabasePlan,
  ) {}

  async read(): Promise<DatabaseUsage> {
    const { data, error } = await this.client.rpc("storage_usage");
    if (error) fail(error);
    const usage = usageSchema.parse(data);
    const limits = SUPABASE_PLANS[this.plan];
    return {
      id: "supabase-main",
      name: "Banco principal",
      provider: "supabase",
      planLabel: limits.label,
      database: { usedBytes: usage.database_bytes, limitBytes: limits.database },
      files: {
        usedBytes: usage.buckets.reduce((sum, bucket) => sum + bucket.bytes, 0),
        limitBytes: limits.files,
        count: usage.buckets.reduce((sum, bucket) => sum + bucket.files, 0),
      },
      tables: usage.tables,
      buckets: usage.buckets,
      measuredAt: usage.measured_at,
    };
  }
}
