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
import type { AdminRole } from "@/domain/admin-user";
import { InvalidMfaCodeError } from "@/domain/errors";

const AUTH_KEY = "jota:demo-auth";
const NAME_KEY = "jota:demo-name";
const MFA_KEY = "jota:demo-mfa";
/** Senha aceita, código ainda não digitado: sobrevive ao recarregar a página, como o token do Supabase. */
const MFA_PENDING_KEY = "jota:demo-mfa-pending";
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

/** O nome fica guardado por e-mail: trocar de login não carrega o nome de outra pessoa. */
const nameKeyOf = (email: string) => `${NAME_KEY}:${email.trim().toLowerCase()}`;

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

/**
 * Sem banco conectado os dados só existem neste navegador, então não há senha a conferir:
 * o painel abre direto e "Sair" leva para a tela de login, que aceita qualquer e-mail.
 * Com o Supabase ligado, o login de verdade assume.
 */
export class DemoAuthService implements AuthService {
  private readonly listeners = new Set<Listener>();

  async getState(): Promise<AuthState> {
    return this.readState();
  }

  async signIn(email: string): Promise<AuthState> {
    writeKey(MFA_PENDING_KEY, this.mfaEnabled() ? MFA_ON : "");
    this.storeEmail(email);
    return this.readState();
  }

  /** Sem servidor para conferir: qualquer código de 6 números passa. */
  async verifyMfa(code: string): Promise<AdminSession> {
    if (!MFA_CODE.test(code)) throw new InvalidMfaCodeError();
    writeKey(MFA_PENDING_KEY, "");
    this.notify();
    return this.sessionOf(readKey(AUTH_KEY) ?? DEFAULT_EMAIL);
  }

  async signOut(): Promise<void> {
    writeKey(MFA_PENDING_KEY, "");
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
    writeKey(MFA_KEY, MFA_ON);
  }

  async disableMfa(): Promise<void> {
    writeKey(MFA_KEY, "");
  }

  /** Não há senha guardada no modo local: conferir e trocar só valem com o Supabase. */
  async verifyPassword(): Promise<void> {}

  async changePassword(): Promise<void> {}

  /** Sem Supabase não há e-mail para enviar: o login local já aceita qualquer acesso. */
  async requestPasswordReset(): Promise<void> {}

  async updateProfile({ name, email }: ProfileUpdate): Promise<ProfileUpdateResult> {
    writeKey(nameKeyOf(email), name);
    this.storeEmail(email);
    return { emailConfirmationPending: false };
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private mfaEnabled(): boolean {
    return readKey(MFA_KEY) === MFA_ON;
  }

  private readState(): AuthState {
    const email = readKey(AUTH_KEY);
    if (email === SIGNED_OUT) return { status: "signed-out" };
    if (readKey(MFA_PENDING_KEY) === MFA_ON) return { status: "mfa-required" };
    return { status: "signed-in", session: this.sessionOf(email ?? DEFAULT_EMAIL) };
  }

  private sessionOf(email: string): AdminSession {
    const known = KNOWN_PEOPLE[email.trim().toLowerCase()];
    const name = readKey(nameKeyOf(email)) ?? known?.name ?? null;
    return { email, name, role: known?.role ?? "admin", recoveringPassword: false };
  }

  private storeEmail(value: string) {
    writeKey(AUTH_KEY, value);
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
