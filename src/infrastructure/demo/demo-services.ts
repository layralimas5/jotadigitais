import type {
  AdminSession,
  AuthService,
  AuthState,
  ImageStorage,
  MfaEnrollment,
  PreparedImage,
  ProfileUpdate,
  ProfileUpdateResult,
  UploadedImage,
} from "@/application/ports";
import type { AdminRole, StaffPermission } from "@/domain/admin-user";
import { InvalidMfaCodeError } from "@/domain/errors";

/** Senha aceita, código ainda não digitado: sobrevive ao recarregar a página, como o token do Supabase. */
const DEMO_FACTOR_ID = "demo-totp";
const MFA_ON = "on";
const MFA_CODE = /^\d{6}$/;
const SIGNED_OUT = "signed-out";
/** Mesmo dono que a aba Usuários mostra no modo demonstração. */
const DEFAULT_EMAIL = "jota@jotadigitais.com.br";

/** Quem já tem nome e papel conhecidos; qualquer outro e-mail entra como admin sem nome até preencher o perfil. */
const KNOWN_PEOPLE: Record<string, { name: string; role: AdminRole }> = {
  [DEFAULT_EMAIL]: { name: "Jota", role: "admin" },
  "layralimas5@gmail.com": { name: "Layra", role: "developer" },
};


type Listener = (state: AuthState) => void;

function readKey(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch (error) {
    console.error("Falha ao ler a sessão local", error);
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    console.error("Falha ao gravar a sessão local", error);
  }
}

function removeKey(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.error("Falha ao apagar da sessão local", error);
  }
}

function dataUrlOf(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Imagem ilegível.")));
    reader.onerror = () => reject(reader.error ?? new Error("Imagem ilegível."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Sem banco conectado os dados só existem neste navegador, então não há senha a conferir:
 * o painel abre direto e "Sair" leva para a tela de login, que aceita qualquer e-mail.
 * Com o Supabase ligado, o login de verdade assume.
 */
/** Papel e áreas de quem foi cadastrado na aba Usuários do modo demonstração. */
export type DemoAccessLookup = (email: string) => { role: AdminRole; permissions: StaffPermission[] } | null;

export class DemoAuthService implements AuthService {
  private readonly listeners = new Set<Listener>();

  private readonly authKey: string;
  private readonly nameKey: string;
  private readonly mfaKey: string;
  private readonly mfaPendingKey: string;

  /** @param keyPrefix o ambiente de teste do painel usa outro prefixo: login e perfil de lá não mexem no modo demonstração. */
  constructor(
    private readonly lookupAccess?: DemoAccessLookup,
    keyPrefix = "jota:demo",
  ) {
    this.authKey = `${keyPrefix}-auth`;
    this.nameKey = `${keyPrefix}-name`;
    this.mfaKey = `${keyPrefix}-mfa`;
    this.mfaPendingKey = `${keyPrefix}-mfa-pending`;
  }

  /** O nome fica guardado por e-mail: trocar de login não carrega o nome de outra pessoa. */
  private nameKeyOf(email: string): string {
    return `${this.nameKey}:${email.trim().toLowerCase()}`;
  }

  /** A foto também, como data URL (sem banco, não há onde hospedar o arquivo). */
  private avatarKeyOf(email: string): string {
    return `${this.nameKey}-avatar:${email.trim().toLowerCase()}`;
  }

  async getState(): Promise<AuthState> {
    return this.readState();
  }

  async signIn(email: string): Promise<AuthState> {
    writeKey(this.mfaPendingKey, this.mfaEnabled() ? MFA_ON : "");
    this.storeEmail(email);
    return this.readState();
  }

  /** Sem servidor para conferir: qualquer código de 6 números passa. */
  async verifyMfa(code: string): Promise<AdminSession> {
    if (!MFA_CODE.test(code)) throw new InvalidMfaCodeError();
    writeKey(this.mfaPendingKey, "");
    this.notify();
    return this.sessionOf(readKey(this.authKey) ?? DEFAULT_EMAIL);
  }

  async signOut(): Promise<void> {
    writeKey(this.mfaPendingKey, "");
    this.storeEmail(SIGNED_OUT);
  }

  async getMfaFactorId(): Promise<string | null> {
    return this.mfaEnabled() ? DEMO_FACTOR_ID : null;
  }

  async startMfaEnrollment(): Promise<MfaEnrollment> {
    return { factorId: DEMO_FACTOR_ID, qrCode: null, secret: "JOTADEMODUASETAPAS" };
  }

  async confirmMfaEnrollment(_factorId: string, code: string): Promise<void> {
    if (!MFA_CODE.test(code)) throw new InvalidMfaCodeError();
    writeKey(this.mfaKey, MFA_ON);
  }

  async disableMfa(): Promise<void> {
    writeKey(this.mfaKey, "");
  }

  /** Não há senha guardada no modo local: conferir e trocar só valem com o Supabase. */
  async verifyPassword(): Promise<void> {}

  async changePassword(): Promise<void> {}

  /** Sem Supabase não há e-mail para enviar: o login local já aceita qualquer acesso. */
  async requestPasswordReset(): Promise<void> {}

  async updateProfile({ name, email }: ProfileUpdate): Promise<ProfileUpdateResult> {
    writeKey(this.nameKeyOf(email), name);
    this.storeEmail(email);
    return { emailConfirmationPending: false };
  }

  async updateAvatar(image: PreparedImage | null): Promise<void> {
    const email = readKey(this.authKey) ?? DEFAULT_EMAIL;
    if (image) writeKey(this.avatarKeyOf(email), await dataUrlOf(image.blob));
    else removeKey(this.avatarKeyOf(email));
    this.notify();
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private mfaEnabled(): boolean {
    return readKey(this.mfaKey) === MFA_ON;
  }

  private readState(): AuthState {
    const email = readKey(this.authKey);
    if (email === SIGNED_OUT) return { status: "signed-out" };
    if (readKey(this.mfaPendingKey) === MFA_ON) return { status: "mfa-required" };
    return { status: "signed-in", session: this.sessionOf(email ?? DEFAULT_EMAIL) };
  }

  private sessionOf(email: string): AdminSession {
    const known = KNOWN_PEOPLE[email.trim().toLowerCase()];
    const registered = this.lookupAccess?.(email) ?? null;
    const name = readKey(this.nameKeyOf(email)) ?? known?.name ?? null;
    return {
      email,
      name,
      avatarUrl: readKey(this.avatarKeyOf(email)),
      role: known?.role ?? registered?.role ?? "admin",
      permissions: known ? [] : (registered?.permissions ?? []),
      recoveringPassword: false,
    };
  }

  private storeEmail(value: string) {
    writeKey(this.authKey, value);
    this.notify();
  }

  private notify() {
    const state = this.readState();
    this.listeners.forEach((listener) => listener(state));
  }
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler a imagem."));
    reader.readAsDataURL(blob);
  });
}

/** No modo demo a imagem vira data URL e fica guardada junto com o resto no localStorage. */
export class DemoImageStorage implements ImageStorage {
  async upload(image: PreparedImage): Promise<UploadedImage> {
    return { url: await toDataUrl(image.blob), width: image.width, height: image.height };
  }
}
