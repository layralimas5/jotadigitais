import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { AdminStockAlertRepository, StockAlertService } from "@/application/ports";
import { TooManyAttemptsError } from "@/domain/errors";
import { isStockAlertCategory, type StockAlert, type StockAlertData } from "@/domain/stock-alert";
import { fail, failFromRpc } from "./supabase-repositories";

const COLUMNS = "id, name, whatsapp, categories, created_at, notified_at";

const rowSchema = z.object({
  id: z.string(),
  name: z.string(),
  whatsapp: z.string(),
  categories: z.array(z.string()),
  created_at: z.string(),
  notified_at: z.string().nullable(),
});

function toStockAlert(raw: unknown): StockAlert {
  const row = rowSchema.parse(raw);
  return {
    id: row.id,
    name: row.name,
    whatsapp: row.whatsapp,
    categories: row.categories.filter(isStockAlertCategory),
    createdAt: row.created_at,
    notifiedAt: row.notified_at,
  };
}

export class SupabaseStockAlertService implements StockAlertService {
  constructor(private readonly client: SupabaseClient) {}

  async subscribe(data: StockAlertData): Promise<void> {
    const { error } = await this.client.rpc("subscribe_stock_alert", {
      p_name: data.name,
      p_whatsapp: data.whatsapp,
      p_categories: data.categories,
    });
    if (error?.message.includes("too_many_attempts")) throw new TooManyAttemptsError();
    if (error) failFromRpc(error);
  }
}

export class SupabaseStockAlertRepository implements AdminStockAlertRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listAll(): Promise<StockAlert[]> {
    const { data, error } = await this.client.from("stock_alerts").select(COLUMNS).order("created_at", { ascending: false });
    if (error) fail(error);
    return (data ?? []).map(toStockAlert);
  }

  async setNotified(id: string, notified: boolean): Promise<void> {
    const { error } = await this.client
      .from("stock_alerts")
      .update({ notified_at: notified ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) fail(error);
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.client.from("stock_alerts").delete().eq("id", id);
    if (error) fail(error);
  }
}
