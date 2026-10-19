import { container } from "@/app/container";
import { SETTINGS_PATH } from "../navigation";

/** Senha e e-mail de verdade só existem com o Supabase ligado; no modo demonstração o login aceita qualquer acesso. */
export const HAS_REAL_AUTH = container.mode === "supabase";

/** Para onde voltam os links de e-mail (redefinir senha, confirmar e-mail novo). */
export const settingsUrl = () => `${window.location.origin}${SETTINGS_PATH}`;
