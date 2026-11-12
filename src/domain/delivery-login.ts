import type { AccountAccess } from "./email-account";

/** Login do próprio perfil na rede (o @ ou usuário e a senha dele), separado do e-mail da conta. */
export interface ProfileLogin {
  username: string | null;
  /** Nula quando ainda não foi anotada ou quando quem vê não tem acesso às senhas. */
  password: string | null;
}

/** Tudo que vai para quem comprou: o e-mail da conta (com a senha dele) e o login do perfil. */
export interface DeliveryLogin {
  email: AccountAccess | null;
  profile: ProfileLogin | null;
}

export const EMPTY_DELIVERY_LOGIN: DeliveryLogin = { email: null, profile: null };

export const hasProfileLogin = (profile: ProfileLogin | null): profile is ProfileLogin =>
  profile !== null && (profile.username !== null || profile.password !== null);
