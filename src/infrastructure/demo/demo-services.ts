import type { AdminSession, AuthService, ImageStorage, PreparedImage, UploadedImage } from "@/application/ports";

const SESSION_KEY = "jota:demo-admin";

function readSession(): AdminSession | null {
  try {
    const email = window.sessionStorage.getItem(SESSION_KEY);
    return email ? { email } : null;
  } catch {
    return null;
  }
}

/**
 * Login de demonstração: aceita qualquer e-mail e senha válidos e vale só nesta aba.
 * Não protege nada de verdade, porque no modo demo os dados também só existem neste navegador.
 */
export class DemoAuthService implements AuthService {
  private listeners = new Set<(session: AdminSession | null) => void>();

  async getSession(): Promise<AdminSession | null> {
    return readSession();
  }

  async signIn(email: string): Promise<AdminSession> {
    window.sessionStorage.setItem(SESSION_KEY, email);
    const session = { email };
    this.listeners.forEach((listener) => listener(session));
    return session;
  }

  async signOut(): Promise<void> {
    window.sessionStorage.removeItem(SESSION_KEY);
    this.listeners.forEach((listener) => listener(null));
  }

  onChange(listener: (session: AdminSession | null) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
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
