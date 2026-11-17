import type { AdminTagColorRepository } from "@/application/ports";
import type { TagColors } from "@/domain/tag-color";
import { simulateLatency, type DemoDatabase } from "./demo-database";

export class DemoTagColorRepository implements AdminTagColorRepository {
  constructor(private readonly db: DemoDatabase) {}

  async list(): Promise<TagColors> {
    return this.db.read().tagColors ?? {};
  }

  async set(key: string, color: string | null): Promise<void> {
    await simulateLatency();
    this.db.write((state) => {
      const next = { ...state.tagColors };
      if (color === null) delete next[key];
      else next[key] = color;
      state.tagColors = next;
    });
  }
}
