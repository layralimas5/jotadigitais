import type { AdminWhatsAppRepository } from "@/application/ports";
import { DEFAULT_WHATSAPP_SETTINGS, type WhatsAppMessage, type WhatsAppSettings } from "@/domain/whatsapp";
import { simulateLatency, type DemoDatabase } from "./demo-database";

/** No modo demonstração não há Meta nem função: só o liga e desliga, e o registro fica vazio. */
export class DemoWhatsAppRepository implements AdminWhatsAppRepository {
  constructor(private readonly db: DemoDatabase) {}

  async getSettings(): Promise<WhatsAppSettings> {
    return { ...DEFAULT_WHATSAPP_SETTINGS, autoDelivery: this.db.read().whatsappAutoDelivery ?? DEFAULT_WHATSAPP_SETTINGS.autoDelivery };
  }

  async setAutoDelivery(enabled: boolean): Promise<WhatsAppSettings> {
    await simulateLatency();
    this.db.write((state) => {
      state.whatsappAutoDelivery = enabled;
    });
    return this.getSettings();
  }

  async listMessages(): Promise<WhatsAppMessage[]> {
    return [];
  }
}
