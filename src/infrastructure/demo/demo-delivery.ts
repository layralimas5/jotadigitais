import type { AdminDeliveryMessageRepository, AdminProfileLoginRepository } from "@/application/ports";
import type { ProfileLogin } from "@/domain/delivery-login";
import type { DeliveryMessage, DeliveryMessageData } from "@/domain/delivery-message";
import { DeliveryMessageNotFoundError } from "@/domain/errors";
import { newId, simulateLatency, type DemoDatabase } from "./demo-database";

export class DemoDeliveryMessageRepository implements AdminDeliveryMessageRepository {
  constructor(private readonly db: DemoDatabase) {}

  async listAll(): Promise<DeliveryMessage[]> {
    return [...(this.db.read().deliveryMessages ?? [])].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(data: DeliveryMessageData): Promise<DeliveryMessage> {
    await simulateLatency();
    const now = new Date().toISOString();
    const created: DeliveryMessage = { ...data, id: newId("msg"), createdAt: now, updatedAt: now };
    return this.db.write((state) => {
      state.deliveryMessages = [...(state.deliveryMessages ?? []), created];
      return created;
    });
  }

  async update(id: string, data: DeliveryMessageData): Promise<DeliveryMessage> {
    await simulateLatency();
    return this.db.write((state) => {
      const all = state.deliveryMessages ?? [];
      const current = all.find((item) => item.id === id);
      if (!current) throw new DeliveryMessageNotFoundError();
      const updated: DeliveryMessage = { ...current, ...data, updatedAt: new Date().toISOString() };
      state.deliveryMessages = all.map((item) => (item.id === id ? updated : item));
      return updated;
    });
  }

  async remove(id: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      state.deliveryMessages = (state.deliveryMessages ?? []).filter((item) => item.id !== id);
    });
  }
}

/** Sem banco a senha fica aberta no navegador, como a senha dos e-mails no modo demonstração. */
export class DemoProfileLoginRepository implements AdminProfileLoginRepository {
  constructor(private readonly db: DemoDatabase) {}

  async findByAccountId(accountId: string): Promise<ProfileLogin | null> {
    return this.db.read().profileLogins?.[accountId] ?? null;
  }

  async save(accountId: string, login: ProfileLogin): Promise<ProfileLogin> {
    await simulateLatency();
    return this.db.write((state) => {
      state.profileLogins = { ...state.profileLogins, [accountId]: login };
      return login;
    });
  }

  async remove(accountId: string): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const { [accountId]: _removed, ...rest } = state.profileLogins ?? {};
      state.profileLogins = rest;
    });
  }
}
