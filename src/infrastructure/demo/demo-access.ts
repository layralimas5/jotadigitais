import type { AccessRepository, AuthService } from "@/application/ports";
import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import { sameEmail } from "@/domain/admin-user";
import { AccessForbiddenError, AdminUserEmailTakenError } from "@/domain/errors";
import { simulateLatency, type DemoDatabase } from "./demo-database";
import type { DemoAdminUserRepository } from "./demo-repositories";

interface DemoAccessExtras {
  whatsapp: string | null;
  mfaEnabled: boolean;
  activeSessions: number;
}

const DEFAULT_EXTRAS: DemoAccessExtras = { whatsapp: null, mfaEnabled: false, activeSessions: 1 };

/**
 * Acessos no modo demo: usa a lista de usuários do navegador e guarda à parte o que só a TI vê.
 * Senha não existe no demo (o login aceita qualquer uma); trocar só confirma na tela.
 */
export class DemoAccessRepository implements AccessRepository {
  private readonly extras = new Map<string, DemoAccessExtras>();

  constructor(
    private readonly db: DemoDatabase,
    private readonly users: DemoAdminUserRepository,
    private readonly auth: AuthService,
  ) {}

  async listAll(): Promise<AccessUser[]> {
    await this.requireDeveloper();
    return (await this.users.listAll()).map((user) => ({ ...user, ...(this.extras.get(user.id) ?? DEFAULT_EXTRAS) }));
  }

  async updateProfile(userId: string, update: AccessProfileUpdate): Promise<void> {
    await this.requireDeveloper();
    await simulateLatency();
    const all = await this.users.listAll();
    if (all.some((user) => user.id !== userId && sameEmail(user.email, update.email))) throw new AdminUserEmailTakenError(update.email);
    this.db.write((state) => {
      state.adminUsers = all.map((user) => (user.id === userId ? { ...user, name: update.name, email: update.email } : user));
    });
    this.patch(userId, { whatsapp: update.whatsapp });
  }

  async setPassword(): Promise<void> {
    await this.requireDeveloper();
    await simulateLatency();
  }

  async endSessions(userId: string): Promise<void> {
    await this.requireDeveloper();
    await simulateLatency();
    this.patch(userId, { activeSessions: 0 });
  }

  async resetMfa(userId: string): Promise<void> {
    await this.requireDeveloper();
    await simulateLatency();
    this.patch(userId, { mfaEnabled: false });
  }

  private patch(userId: string, change: Partial<DemoAccessExtras>): void {
    this.extras.set(userId, { ...(this.extras.get(userId) ?? DEFAULT_EXTRAS), ...change });
  }

  private async requireDeveloper(): Promise<void> {
    const state = await this.auth.getState();
    if (state.status !== "signed-in" || state.session.role !== "developer") throw new AccessForbiddenError();
  }
}
