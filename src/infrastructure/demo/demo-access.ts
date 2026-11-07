import type { AccessRepository, AuthService } from "@/application/ports";
import type { AccessProfileUpdate, AccessUser } from "@/domain/access-user";
import { canManageLoginOf, sameEmail } from "@/domain/admin-user";
import { AccessForbiddenError, AdminUserEmailTakenError } from "@/domain/errors";
import { simulateLatency, type DemoDatabase } from "./demo-database";
import type { DemoAdminUserRepository } from "./demo-repositories";

interface DemoAccessExtras {
  mfaEnabled: boolean;
  activeSessions: number;
}

const DEFAULT_EXTRAS: DemoAccessExtras = { mfaEnabled: false, activeSessions: 1 };

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
    await this.requireCanManage(userId);
    await simulateLatency();
    const all = await this.users.listAll();
    if (all.some((user) => user.id !== userId && sameEmail(user.email, update.email))) throw new AdminUserEmailTakenError(update.email);
    this.db.write((state) => {
      state.adminUsers = all.map((user) =>
        user.id === userId ? { ...user, name: update.name, email: update.email, whatsapp: update.whatsapp } : user,
      );
    });
  }

  async setPassword(userId: string): Promise<void> {
    await this.requireCanManage(userId);
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

  /** Mesma regra do servidor: a TI muda de todos; o admin, de todos menos da desenvolvedora e dele mesmo. */
  private async requireCanManage(userId: string): Promise<void> {
    const state = await this.auth.getState();
    const target = (await this.users.listAll()).find((user) => user.id === userId);
    if (state.status !== "signed-in" || !target) throw new AccessForbiddenError();
    if (state.session.role === "admin" && sameEmail(target.email, state.session.email)) throw new AccessForbiddenError();
    if (!canManageLoginOf(state.session.role, target)) throw new AccessForbiddenError();
  }

  private async requireDeveloper(): Promise<void> {
    const state = await this.auth.getState();
    if (state.status !== "signed-in" || state.session.role !== "developer") throw new AccessForbiddenError();
  }
}
