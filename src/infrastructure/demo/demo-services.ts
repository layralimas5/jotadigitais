import type { AdminSession, AuthService, ImageStorage, PreparedImage, UploadedImage } from "@/application/ports";

const AUTH_KEY = "jota:demo-auth";
const SIGNED_OUT = "signed-out";
const DEFAULT_SESSION: AdminSession = { email: "Administrador" };

type Listener = (session: AdminSession | null) => void;

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
    this.store(email);
    return { email };
  }

  async signOut(): Promise<void> {
    this.store(SIGNED_OUT);
  }

  /** Não há senha guardada no modo local: a troca só vale com o Supabase. */
  async changePassword(): Promise<void> {}

  /** Sem Supabase não há e-mail para enviar: o login local já aceita qualquer acesso. */
  async requestPasswordReset(): Promise<void> {}

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private readSession(): AdminSession | null {
    try {
      const stored = window.localStorage.getItem(AUTH_KEY);
      if (stored === SIGNED_OUT) return null;
      return stored ? { email: stored } : DEFAULT_SESSION;
    } catch (error) {
      console.error("Falha ao ler a sessão local", error);
      return DEFAULT_SESSION;
    }
  }

  private store(value: string) {
    try {
      window.localStorage.setItem(AUTH_KEY, value);
    } catch (error) {
      console.error("Falha ao gravar a sessão local", error);
    }
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
