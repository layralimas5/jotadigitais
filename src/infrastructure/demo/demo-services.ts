import type { AdminSession, AuthService, ImageStorage, PreparedImage, UploadedImage } from "@/application/ports";

const DEMO_SESSION: AdminSession = { email: "Modo demonstração" };

/**
 * Sem banco conectado o painel abre direto, sem login: os dados só existem neste navegador,
 * então não há nada a proteger. Com o Supabase ligado, o login volta a ser obrigatório.
 */
export class DemoAuthService implements AuthService {
  async getSession(): Promise<AdminSession | null> {
    return DEMO_SESSION;
  }

  async signIn(): Promise<AdminSession> {
    return DEMO_SESSION;
  }

  async signOut(): Promise<void> {}

  onChange(): () => void {
    return () => {};
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
