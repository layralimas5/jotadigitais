import type { AuthError, Session, SupabaseClient } from "@supabase/supabase-js";
import type {
  AdminSession,
  AuthService,
  AuthState,
  ImageStorage,
  MediaFolder,
  MfaEnrollment,
  PreparedImage,
  ProfileUpdate,
  ProfileUpdateResult,
  UploadedImage,
} from "@/application/ports";
import { sameEmail, type AdminRole } from "@/domain/admin-user";
import { InvalidCredentialsError, InvalidMfaCodeError, NotAdminError, WrongCurrentPasswordError } from "@/domain/errors";
import { logBackendError } from "./supabase-repositories";

const MEDIA_BUCKET = "media";
const MFA_FRIENDLY_NAME = "Painel Jota Digitais";
const SIGNED_OUT: AuthState = { status: "signed-out" };

/** Código errado, vencido ou já usado. */
const isWrongMfaCode = (error: AuthError): boolean =>
  error.code === "mfa_verification_failed" || error.code === "mfa_challenge_expired" || error.status === 422;

/**
 * Login do Jota pelo Supabase Auth. Só entra quem também está na tabela `admin_users`.
 * Quem ligou a verificação em duas etapas passa pelo código do app autenticador: sem ele o banco não libera nada (is_admin).
 */
export class SupabaseAuthService implements AuthService {
  private recoveringPassword = false;

  /**
   * @param createPasswordChecker cliente avulso, que não guarda sessão. Conferir a senha atual abre uma sessão só para
   * isso; no cliente do painel ela substituiria a sessão em uso e derrubaria a verificação em duas etapas.
   */
  constructor(
    private readonly client: SupabaseClient,
    private readonly createPasswordChecker: () => SupabaseClient,
  ) {
    // Registrado antes de qualquer tela: o aviso de "veio do link de redefinição" chega uma vez só, ao abrir a página.
    client.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") this.recoveringPassword = true;
      if (event === "SIGNED_OUT") this.recoveringPassword = false;
    });
  }

  async getState(): Promise<AuthState> {
    const { data, error } = await this.client.auth.getSession();
    if (error) {
      console.error(error);
      return SIGNED_OUT;
    }
    return this.toState(data.session);
  }

  async signIn(email: string, password: string): Promise<AuthState> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 400) throw new InvalidCredentialsError();
      console.error(error);
      throw new Error("Não foi possível entrar agora. Tente de novo em instantes.");
    }
    const state = await this.toState(data.session);
    if (state.status === "signed-out") throw new NotAdminError();
    return state;
  }

  async verifyMfa(code: string): Promise<AdminSession> {
    const factorId = await this.getMfaFactorId();
    if (!factorId) throw new Error("A verificação em duas etapas não está ligada nesta conta. Entre de novo.");
    await this.verifyCode(factorId, code);
    const state = await this.getState();
    if (state.status !== "signed-in") throw new NotAdminError();
    return state.session;
  }

  async signOut(): Promise<void> {
    const { error } = await this.client.auth.signOut();
    if (error) console.error(error);
  }

  async getMfaFactorId(): Promise<string | null> {
    const { data, error } = await this.client.auth.mfa.listFactors();
    if (error) {
      console.error(error);
      throw new Error("Não foi possível conferir a verificação em duas etapas agora. Tente de novo em instantes.");
    }
    // `totp` traz só os fatores já confirmados.
    return data.totp[0]?.id ?? null;
  }

  async startMfaEnrollment(): Promise<MfaEnrollment> {
    await this.removeUnconfirmedFactors();
    const { data, error } = await this.client.auth.mfa.enroll({ factorType: "totp", friendlyName: MFA_FRIENDLY_NAME });
    if (error) {
      console.error(error);
      throw new Error("Não foi possível começar o cadastro agora. Tente de novo em instantes.");
    }
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
  }

  async confirmMfaEnrollment(factorId: string, code: string): Promise<void> {
    await this.verifyCode(factorId, code);
  }

  async disableMfa(factorId: string): Promise<void> {
    const { error } = await this.client.auth.mfa.unenroll({ factorId });
    if (error) {
      console.error(error);
      throw new Error("Não foi possível desligar agora. Saia, entre de novo com o código e tente outra vez.");
    }
  }

  async verifyPassword(email: string, password: string): Promise<void> {
    const checker = this.createPasswordChecker();
    const { error } = await checker.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.status === 400) throw new WrongCurrentPasswordError();
      console.error(error);
      throw new Error("Não foi possível conferir a senha atual agora. Tente de novo em instantes.");
    }
    // Encerra no servidor só a sessão aberta para a conferência; a do painel continua.
    const { error: signOutError } = await checker.auth.signOut({ scope: "local" });
    if (signOutError) console.error(signOutError);
  }

  async changePassword(newPassword: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ password: newPassword });
    if (!error) {
      this.recoveringPassword = false;
      return;
    }
    console.error(error);
    if (error.code === "same_password") throw new Error("A nova senha precisa ser diferente da atual.");
    if (error.code === "weak_password") throw new Error("Senha fraca. Misture letras, números e símbolos.");
    if (error.code === "reauthentication_needed") throw new Error("Por segurança, saia e entre de novo antes de trocar a senha.");
    if (error.code === "insufficient_aal") throw new Error("Por segurança, saia e entre de novo com o código do app antes de trocar a senha.");
    throw new Error("Não foi possível trocar a senha agora. Tente de novo em instantes.");
  }

  async requestPasswordReset(email: string, redirectTo: string): Promise<void> {
    const { error } = await this.client.auth.resetPasswordForEmail(email, { redirectTo });
    if (!error) return;
    console.error(error);
    if (error.status === 429) throw new Error("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
    throw new Error("Não foi possível enviar o link agora. Tente de novo em instantes.");
  }

  async updateProfile({ name, email }: ProfileUpdate, emailRedirectTo: string): Promise<ProfileUpdateResult> {
    const { error } = await this.client.rpc("update_my_profile", { p_name: name });
    if (error) {
      logBackendError(error);
      throw new Error("Não foi possível salvar o perfil agora. Tente de novo em instantes.");
    }
    const { data } = await this.client.auth.getSession();
    if (sameEmail(data.session?.user.email ?? "", email)) return { emailConfirmationPending: false };
    await this.changeEmail(email, emailRedirectTo);
    return { emailConfirmationPending: true };
  }

  private async changeEmail(email: string, emailRedirectTo: string): Promise<void> {
    const { error } = await this.client.auth.updateUser({ email }, { emailRedirectTo });
    if (!error) return;
    console.error(error);
    if (error.code === "email_exists") throw new Error("Esse e-mail já é usado por outro acesso.");
    if (error.code === "email_address_invalid") throw new Error("Esse e-mail não foi aceito. Confira e tente de novo.");
    if (error.status === 429) throw new Error("Muitas tentativas seguidas. Espere alguns minutos e tente de novo.");
    throw new Error("O nome foi salvo, mas não foi possível trocar o e-mail agora. Tente de novo em instantes.");
  }

  onChange(listener: (state: AuthState) => void): () => void {
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      // O callback do Supabase não pode aguardar outras chamadas do client: a checagem de admin vai para a próxima volta.
      setTimeout(() => {
        void this.toState(session).then(listener);
      }, 0);
    });
    return () => data.subscription.unsubscribe();
  }

  private async verifyCode(factorId: string, code: string): Promise<void> {
    const { error } = await this.client.auth.mfa.challengeAndVerify({ factorId, code });
    if (!error) return;
    if (isWrongMfaCode(error)) throw new InvalidMfaCodeError();
    console.error(error);
    throw new Error("Não foi possível conferir o código agora. Tente de novo em instantes.");
  }

  /** Cadastro começado e não confirmado atrapalha um novo (o nome do fator precisa ser único). */
  private async removeUnconfirmedFactors(): Promise<void> {
    const { data, error } = await this.client.auth.mfa.listFactors();
    if (error) {
      console.error(error);
      return;
    }
    const unconfirmed = data.all.filter((factor) => factor.factor_type === "totp" && factor.status === "unverified");
    const results = await Promise.all(unconfirmed.map((factor) => this.client.auth.mfa.unenroll({ factorId: factor.id })));
    results.forEach((result) => {
      if (result.error) console.error(result.error);
    });
  }

  private async needsMfaCode(): Promise<boolean> {
    const { data, error } = await this.client.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) {
      console.error(error);
      return false;
    }
    return data.nextLevel === "aal2" && data.currentLevel !== "aal2";
  }

  private async toState(session: Session | null): Promise<AuthState> {
    if (!session?.user.email) return SIGNED_OUT;
    if (await this.needsMfaCode()) return { status: "mfa-required" };
    // A tabela só deixa administrador ler: achar a própria linha já confirma o acesso.
    const { data, error } = await this.client
      .from("admin_users")
      .select("name, role")
      .eq("user_id", session.user.id)
      .maybeSingle<{ name: string | null; role: AdminRole }>();
    if (error) {
      logBackendError(error);
      return SIGNED_OUT;
    }
    if (!data) {
      // O banco não aceita mais esta sessão (aberta há mais de 7 dias, acesso removido ou quem não é admin):
      // encerra para o login aparecer limpo, em vez de um painel vazio.
      const { error: signOutError } = await this.client.auth.signOut({ scope: "local" });
      if (signOutError) console.error(signOutError);
      return SIGNED_OUT;
    }
    const adminSession = { email: session.user.email, name: data.name, role: data.role, recoveringPassword: this.recoveringPassword };
    return { status: "signed-in", session: adminSession };
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
