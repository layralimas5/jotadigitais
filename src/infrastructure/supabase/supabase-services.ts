import type { Session, SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminSession,
  AuthService,
  ImageStorage,
  MediaFolder,
  PreparedImage,
  UploadedImage,
} from "@/application/ports";
import { InvalidCredentialsError, NotAdminError } from "@/domain/errors";

const MEDIA_BUCKET = "media";

/** Login do Jota pelo Supabase Auth. Só entra quem também está na tabela `admin_users`. */
export class SupabaseAuthService implements AuthService {
  constructor(private readonly client: SupabaseClient) {}

  async getSession(): Promise<AdminSession | null> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      console.error(error);
      return null;
    }
    return this.toAdminSession(data.session);
  }

  async signIn(email: string, password: string): Promise<AdminSession> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 400) throw new InvalidCredentialsError();
      console.error(error);
      throw new Error("Não foi possível entrar agora. Tente de novo em instantes.");
    }
    const session = await this.toAdminSession(data.session);
    if (!session) {
      await this.client.auth.signOut();
      throw new NotAdminError();
    }
    return session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) console.error(error);
  }

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (!error) return;
    console.error(error);
    if (error.code === "same_password") throw new Error("A nova senha precisa ser diferente da atual.");
    if (error.code === "weak_password") throw new Error("Senha fraca. Misture letras, números e símbolos.");
    if (error.code === "reauthentication_needed") throw new Error("Por segurança, saia e entre de novo antes de trocar a senha.");
    throw new Error("Não foi possível trocar a senha agora. Tente de novo em instantes.");
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (!error) return;
    console.error(error);
    if (error.status === 429) throw new Error("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
    throw new Error("Não foi possível enviar o link agora. Tente de novo em instantes.");
  }

  onChange(listener: (session: AdminSession | null) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      // O callback do Supabase não pode aguardar outras chamadas do client: a checagem de admin vai para a próxima volta.
      setTimeout(() => {
        void this.toAdminSession(session).then(listener);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }

  private async toAdminSession(session: Session | null): Promise<AdminSession | null> {
    if (!session?.user.email) return null;
    const { data, error } = await this.client.rpc("is_admin");
    if (error) {
      console.error(error);
      return null;
    }
    return data === true ? { email: session.user.email } : null;
  }
}

export class SupabaseImageStorage implements ImageStorage {
  constructor(private readonly client: SupabaseClient) {}

  async upload(image: PreparedImage, folder: MediaFolder): Promise<UploadedImage> {
    const extension = image.blob.type === "image/jpeg" ? "jpg" : "webp";
    const path = `${folder}/${crypto.randomUUID()}.${extension}`;
    const { error } = await this.client.storage
      .from(MEDIA_BUCKET)
      .upload(path, image.blob, { contentType: image.blob.type || "image/webp", cacheControl: "31536000" });
    if (error) {
      console.error(error);
      throw new Error("Não foi possível enviar a imagem. Tente de novo.");
    }
    const { data } = this.client.storage.from(MEDIA_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, width: image.width, height: image.height };
  }
}
