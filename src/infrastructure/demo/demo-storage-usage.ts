import type { StorageUsageReader } from "@/application/ports";
import { SUPABASE_PLANS, type DatabaseUsage } from "@/domain/storage";

const KB = 1024;
const MB = 1024 * KB;

/** Números de exemplo, parecidos com os da loja real, para a aba funcionar no modo demonstração. */
export class DemoStorageUsageReader implements StorageUsageReader {
  readonly name = "Supabase (exemplo)";

  async read(): Promise<DatabaseUsage> {
    const plan = SUPABASE_PLANS.free;
    const buckets = [
      { id: "media", public: true, files: 64, bytes: 14 * MB },
      { id: "support", public: false, files: 17, bytes: 2 * MB },
    ];
    return {
      id: "demo",
      name: "Banco principal",
      provider: "supabase",
      planLabel: plan.label,
      database: { usedBytes: 15 * MB, limitBytes: plan.database },
      files: { usedBytes: buckets.reduce((sum, b) => sum + b.bytes, 0), limitBytes: plan.files, count: buckets.reduce((sum, b) => sum + b.files, 0) },
      tables: [
        { name: "site_content", bytes: 208 * KB, rows: 1 },
        { name: "support_tickets", bytes: 152 * KB, rows: 48 },
        { name: "orders", bytes: 144 * KB, rows: 120 },
        { name: "accounts", bytes: 144 * KB, rows: 37 },
        { name: "support_replies", bytes: 120 * KB, rows: 210 },
        { name: "order_payments", bytes: 112 * KB, rows: 131 },
        { name: "notifications", bytes: 104 * KB, rows: 300 },
        { name: "support_attachments", bytes: 96 * KB, rows: 40 },
        { name: "customers", bytes: 80 * KB, rows: 95 },
        { name: "expenses", bytes: 48 * KB, rows: 60 },
      ],
      buckets,
      measuredAt: new Date().toISOString(),
    };
  }
}
