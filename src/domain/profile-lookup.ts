import type { Platform } from "./platform";

/** Dados públicos de um perfil, puxados da rede pelo link. Mesmo formato da função `account-lookup`. */
export interface ProfileLookup {
  platform: Extract<Platform, "tiktok" | "instagram" | "youtube">;
  handle: string;
  displayName: string;
  profileUrl: string;
  followers: number;
  /** A rede mostrou o número arredondado (ex.: 12,4 mil): vale conferir no app. */
  approximate: boolean;
  following: number | null;
  likes: number | null;
  posts: number | null;
  videos: number | null;
  views: number | null;
  professional: boolean | null;
  verified: boolean | null;
  bio: string | null;
  avatarDataUrl: string | null;
  fetchedAt: string;
}

export const PROFILE_LOOKUP_ERRORS = ["invalid_url", "unsupported", "not_found", "blocked", "failed", "unavailable"] as const;

export type ProfileLookupErrorCode = (typeof PROFILE_LOOKUP_ERRORS)[number];

const MESSAGE: Record<ProfileLookupErrorCode, string> = {
  invalid_url: "Esse link não é de um perfil. Cole o link da página da conta, como tiktok.com/@nome.",
  unsupported: "Por enquanto dá para puxar dados de TikTok, Instagram e YouTube.",
  not_found: "Não achamos esse perfil. Confira se o link está certo e se a conta existe.",
  blocked: "A rede não liberou os dados agora. Tente de novo em alguns minutos ou preencha à mão.",
  failed: "Não foi possível buscar os dados agora. Tente de novo ou preencha à mão.",
  unavailable: "A busca de dados precisa do servidor. Ligue o Supabase ou rode o sistema com npm run dev.",
};

export class ProfileLookupError extends Error {
  readonly code: ProfileLookupErrorCode;

  constructor(code: ProfileLookupErrorCode) {
    super(MESSAGE[code]);
    this.name = "ProfileLookupError";
    this.code = code;
  }
}

export interface ProfileInsight {
  label: string;
  value: string;
}

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

const ratio = (part: number | null, whole: number | null) => (part !== null && whole ? part / whole : null);

/** Leituras rápidas a partir dos números públicos, para ajudar a precificar e a vender a conta. */
export function insightsOf(profile: ProfileLookup): ProfileInsight[] {
  const insights: ProfileInsight[] = [];
  const perVideo = ratio(profile.platform === "youtube" ? profile.views : profile.likes, profile.videos);
  if (perVideo !== null) {
    insights.push({ label: profile.platform === "youtube" ? "Média de visualizações por vídeo" : "Média de curtidas por vídeo", value: number.format(Math.round(perVideo)) });
  }
  const likesPerFollower = profile.platform === "tiktok" ? ratio(profile.likes, profile.followers) : null;
  if (likesPerFollower !== null) insights.push({ label: "Curtidas por seguidor", value: number.format(likesPerFollower) });
  const followRatio = ratio(profile.followers, profile.following);
  if (followRatio !== null) insights.push({ label: "Seguidores para cada perfil seguido", value: number.format(followRatio) });
  const postsPerFollowerK = profile.platform === "instagram" ? ratio(profile.posts, profile.followers / 1000) : null;
  if (postsPerFollowerK !== null) insights.push({ label: "Publicações a cada mil seguidores", value: number.format(postsPerFollowerK) });
  return insights;
}
