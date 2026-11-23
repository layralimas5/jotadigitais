import type { AdminStockAlertRepository, StockAlertService } from "@/application/ports";
import type { StockAlert, StockAlertData } from "@/domain/stock-alert";
import { newId, type DemoDatabase } from "./demo-database";

/** Mesma regra de `subscribe_stock_alert`: um pedido por número, que junta os tipos enquanto espera. */
export class DemoStockAlertService implements StockAlertService {
  constructor(private readonly db: DemoDatabase) {}

  async subscribe(data: StockAlertData): Promise<void> {
    this.db.write((state) => {
      const alerts = (state.stockAlerts ??= []);
      const current = alerts.find((alert) => alert.whatsapp === data.whatsapp);
      if (!current) {
        alerts.push({ ...data, id: newId("alr"), createdAt: new Date().toISOString(), notifiedAt: null });
        return;
      }
      const waiting = current.notifiedAt === null;
      current.name = data.name;
      current.categories = waiting ? [...new Set([...current.categories, ...data.categories])] : data.categories;
      if (!waiting) current.createdAt = new Date().toISOString();
      current.notifiedAt = null;
    });
  }
}

export class DemoStockAlertRepository implements AdminStockAlertRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<StockAlert[]> {
    return [...(this.db.read().stockAlerts ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async setNotified(id: string, notified: boolean): Promise<void> {
    this.db.write((state) => {
      const alert = state.stockAlerts?.find((item) => item.id === id);
      if (alert) alert.notifiedAt = notified ? new Date().toISOString() : null;
    });
  }

  async remove(id: string): Promise<void> {
    this.db.write((state) => {
      state.stockAlerts = (state.stockAlerts ?? []).filter((item) => item.id !== id);
    });
  }
}
