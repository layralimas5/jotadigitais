import type {
  AdminSession,
  AuthService,
  ImageStorage,
  PreparedImage,
  ProfileUpdate,
  ProfileUpdateResult,
  UploadedImage,
} from "@/application/ports";
import type { AdminRole } from "@/domain/admin-user";

const AUTH_KEY = "jota:demo-auth";
const NAME_KEY = "jota:demo-name";
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

type Listener = (session: AdminSession | null) => void;

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

  async getSession(): Promise<AdminSession | null> {
    return this.readSession();
  }

  async signIn(email: string): Promise<AdminSession> {
    this.storeEmail(email);
    return this.sessionOf(email);
  }

  async signOut(): Promise<void> {
    this.storeEmail(SIGNED_OUT);
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

  private readSession(): AdminSession | null {
    const email = readKey(AUTH_KEY);
    if (email === SIGNED_OUT) return null;
    return this.sessionOf(email ?? DEFAULT_EMAIL);
  }

  private sessionOf(email: string): AdminSession {
    const known = KNOWN_PEOPLE[email.trim().toLowerCase()];
    const name = readKey(nameKeyOf(email)) ?? known?.name ?? null;
    return { email, name, role: known?.role ?? "admin", recoveringPassword: false };
  }

  private storeEmail(value: string) {
    writeKey(AUTH_KEY, value);
    const session = this.readSession();
    this.listeners.forEach((listener) => listener(session));
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
