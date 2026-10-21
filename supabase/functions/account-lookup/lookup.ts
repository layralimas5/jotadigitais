// Lê o perfil público de uma conta (TikTok, Instagram ou YouTube) a partir do link.
// Só usa `fetch`: roda igual na Edge Function do Supabase (Deno) e no servidor de desenvolvimento do Vite (Node).
// As redes não têm API pública para isso, então os dados vêm da própria página do perfil. Se a rede mudar
// a página ou bloquear o acesso, a busca falha com um código claro e o cadastro manual continua valendo.

export type LookupPlatform = "tiktok" | "instagram" | "youtube";

export interface ProfileLookup {
  platform: LookupPlatform;
  handle: string;
  displayName: string;
  profileUrl: string;
  followers: number;
  /** A rede mostra o número arredondado (ex.: 12,4 mil): vale conferir no app. */
  approximate: boolean;
  following: number | null;
  likes: number | null;
  posts: number | null;
  videos: number | null;
  views: number | null;
  professional: boolean | null;
  verified: boolean | null;
  bio: string | null;
  /** Foto de perfil já baixada, porque o link da rede expira em poucas horas. */
  avatarDataUrl: string | null;
  fetchedAt: string;
}

export type LookupErrorCode = "invalid_url" | "unsupported" | "not_found" | "blocked" | "failed";

export class LookupError extends Error {
  readonly code: LookupErrorCode;

  constructor(code: LookupErrorCode) {
    super(code);
    this.name = "LookupError";
    this.code = code;
  }
}

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
  "Accept-Language": "en-US,en;q=0.9",
  Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
};

/** O YouTube responde a página completa para navegador de computador; para celular, devolve outra versão. */
const DESKTOP_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const TIMEOUT_MS = 12_000;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

interface ProfileTarget {
  platform: LookupPlatform;
  url: URL;
}

async function get(url: string, extraHeaders: Record<string, string> = {}): Promise<Response> {
  try {
    return await fetch(url, { headers: { ...HEADERS, ...extraHeaders }, redirect: "follow", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new LookupError("failed");
  }
}

async function getText(url: string, extraHeaders?: Record<string, string>): Promise<string> {
  const response = await get(url, extraHeaders);
  if (response.status === 404) throw new LookupError("not_found");
  if (response.status === 429 || response.status === 403) throw new LookupError("blocked");
  if (!response.ok) throw new LookupError("failed");
  return response.text();
}

/** Aceita também o que a pessoa costuma digitar de cabeça, como tiktok.com.br. */
const hostOf = (url: URL) => url.hostname.replace(/^(www|m)\./, "").replace(/\.com\.br$/, ".com");

/** Link curto do TikTok (vm.tiktok.com/...) aponta para o perfil depois do redirecionamento. */
async function resolveShortLink(url: URL): Promise<URL> {
  if (!/^(vm|vt)\.tiktok\.com$/.test(url.hostname)) return url;
  const response = await get(url.toString());
  return new URL(response.url);
}

export async function parseProfileUrl(raw: string): Promise<ProfileTarget> {
  let url: URL;
  try {
    url = new URL(raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`);
  } catch {
    throw new LookupError("invalid_url");
  }
  url = await resolveShortLink(url);
  const host = hostOf(url);
  if (host === "tiktok.com") return { platform: "tiktok", url };
  if (host === "instagram.com") return { platform: "instagram", url };
  if (host === "youtube.com") return { platform: "youtube", url };
  throw new LookupError("unsupported");
}

// ---------------------------------------------------------------------------
// Números e texto
// ---------------------------------------------------------------------------

const SUFFIX: Record<string, number> = { K: 1e3, M: 1e6, B: 1e9 };

/** "1,259" vira 1259; "46.5M" vira 46.500.000 (marcado como aproximado). */
export function parseCount(text: string): { value: number; approximate: boolean } | null {
  const match = text.trim().match(/^([\d.,]+)\s*([KMB])?/i);
  if (!match?.[1]) return null;
  const suffix = match[2]?.toUpperCase();
  if (suffix) {
    const base = Number(match[1].replace(/,/g, ""));
    return Number.isFinite(base) ? { value: Math.round(base * (SUFFIX[suffix] ?? 1)), approximate: true } : null;
  }
  const digits = Number(match[1].replace(/[.,]/g, ""));
  return Number.isFinite(digits) ? { value: digits, approximate: false } : null;
}

const ENTITIES: Record<string, string> = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">", nbsp: " " };

function decodeHtml(text: string): string {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
    .replace(/&(\w+);/g, (match, name: string) => ENTITIES[name] ?? match);
}

function metaContent(html: string, property: string): string | null {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)="${property}"[^>]+content="([^"]*)"`, "i");
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/** Baixa a foto do perfil e devolve como data URL. Sem foto não é erro: a ficha só fica sem ela. */
async function fetchAvatar(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const response = await get(url);
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !type.startsWith("image/")) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) return null;
    return `data:${type.split(";")[0]};base64,${toBase64(bytes)}`;
  } catch {
    return null;
  }
}

const empty = { following: null, likes: null, posts: null, videos: null, views: null, professional: null, verified: null, bio: null };

// ---------------------------------------------------------------------------
// TikTok: a página do perfil traz um JSON com os números exatos
// ---------------------------------------------------------------------------

interface TikTokUserInfo {
  user?: { uniqueId?: string; nickname?: string; avatarLarger?: string; verified?: boolean; signature?: string; commerceUserInfo?: { commerceUser?: boolean } };
  stats?: { followerCount?: number; followingCount?: number; heartCount?: number; videoCount?: number };
  /** Os mesmos números em texto: em contas muito grandes o campo numérico de curtidas estoura. */
  statsV2?: { followerCount?: string; followingCount?: string; heartCount?: string; videoCount?: string };
}

/** Prefere o número em texto (exato) e cai para o numérico. */
function tiktokCount(text: string | undefined, fallback: number | undefined): number | null {
  const parsed = text !== undefined ? Number(text) : Number.NaN;
  if (Number.isSafeInteger(parsed) && parsed >= 0) return parsed;
  return fallback !== undefined && fallback >= 0 ? fallback : null;
}

/** Caminhos do TikTok que não são perfil: sem o @, o primeiro trecho só vira nome de conta fora desta lista. */
const TIKTOK_RESERVED_PATHS = new Set(["video", "t", "tag", "music", "discover", "live", "explore", "foryou", "following"]);

/** tiktok.com/@nome é o formato oficial; tiktok.com/nome também é aceito. */
function tiktokHandleOf(url: URL): string | undefined {
  const first = url.pathname.split("/").filter(Boolean)[0];
  if (!first) return undefined;
  if (first.startsWith("@")) return first.slice(1) || undefined;
  return TIKTOK_RESERVED_PATHS.has(first.toLowerCase()) ? undefined : first;
}

async function lookupTikTok(url: URL): Promise<ProfileLookup> {
  const handle = tiktokHandleOf(url);
  if (!handle) throw new LookupError("invalid_url");
  const html = await getText(`https://www.tiktok.com/@${handle}?lang=en`);
  const json = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/)?.[1];
  if (!json) throw new LookupError("blocked");
  let info: TikTokUserInfo | undefined;
  try {
    info = JSON.parse(json)?.__DEFAULT_SCOPE__?.["webapp.user-detail"]?.userInfo;
  } catch {
    throw new LookupError("failed");
  }
  if (!info?.user?.uniqueId || !info.stats) throw new LookupError("not_found");
  const { user, stats } = info;
  const text = info.statsV2 ?? {};
  return {
    ...empty,
    platform: "tiktok",
    handle: `@${user.uniqueId}`,
    displayName: user.nickname || user.uniqueId || handle,
    profileUrl: `https://www.tiktok.com/@${user.uniqueId}`,
    followers: tiktokCount(text.followerCount, stats.followerCount) ?? 0,
    approximate: false,
    following: tiktokCount(text.followingCount, stats.followingCount),
    likes: tiktokCount(text.heartCount, stats.heartCount),
    videos: tiktokCount(text.videoCount, stats.videoCount),
    verified: user.verified ?? null,
    professional: user.commerceUserInfo?.commerceUser ?? null,
    bio: user.signature || null,
    avatarDataUrl: await fetchAvatar(user.avatarLarger ?? null),
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Instagram: primeiro a API da web (números exatos); se recusar, a descrição da página
// ---------------------------------------------------------------------------

interface InstagramWebUser {
  username?: string;
  full_name?: string;
  biography?: string;
  is_verified?: boolean;
  is_professional_account?: boolean;
  profile_pic_url_hd?: string;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  edge_owner_to_timeline_media?: { count?: number };
}

async function instagramFromApi(username: string): Promise<ProfileLookup | null> {
  const response = await get(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`, {
    "x-ig-app-id": "936619743392459",
  });
  if (response.status === 404) throw new LookupError("not_found");
  if (!response.ok) return null;
  const body: { data?: { user?: InstagramWebUser | null } } | null = await response.json().catch(() => null);
  const user = body?.data?.user;
  if (!user?.username) return null;
  return {
    ...empty,
    platform: "instagram",
    handle: `@${user.username}`,
    displayName: user.full_name || user.username,
    profileUrl: `https://www.instagram.com/${user.username}/`,
    followers: user.edge_followed_by?.count ?? 0,
    approximate: false,
    following: user.edge_follow?.count ?? null,
    posts: user.edge_owner_to_timeline_media?.count ?? null,
    professional: user.is_professional_account ?? null,
    verified: user.is_verified ?? null,
    bio: user.biography || null,
    avatarDataUrl: await fetchAvatar(user.profile_pic_url_hd ?? null),
    fetchedAt: new Date().toISOString(),
  };
}

async function instagramFromPage(username: string): Promise<ProfileLookup> {
  const html = await getText(`https://www.instagram.com/${encodeURIComponent(username)}/`);
  const description = metaContent(html, "og:description");
  const counts = description?.match(/([\d.,]+[KMB]?) Followers, ([\d.,]+[KMB]?) Following, ([\d.,]+[KMB]?) Posts/i);
  if (!counts?.[1]) throw new LookupError(html.includes("Page Not Found") ? "not_found" : "blocked");
  const followers = parseCount(counts[1]);
  const following = counts[2] ? parseCount(counts[2]) : null;
  const posts = counts[3] ? parseCount(counts[3]) : null;
  const title = metaContent(html, "og:title") ?? "";
  return {
    ...empty,
    platform: "instagram",
    handle: `@${username}`,
    displayName: title.split(" (@")[0]?.trim() || username,
    profileUrl: `https://www.instagram.com/${username}/`,
    followers: followers?.value ?? 0,
    approximate: Boolean(followers?.approximate || following?.approximate || posts?.approximate),
    following: following?.value ?? null,
    posts: posts?.value ?? null,
    avatarDataUrl: await fetchAvatar(metaContent(html, "og:image")),
    fetchedAt: new Date().toISOString(),
  };
}

async function lookupInstagram(url: URL): Promise<ProfileLookup> {
  const username = url.pathname.split("/").filter(Boolean)[0];
  if (!username || ["p", "reel", "reels", "stories", "explore"].includes(username)) throw new LookupError("invalid_url");
  return (await instagramFromApi(username)) ?? instagramFromPage(username);
}

// ---------------------------------------------------------------------------
// YouTube: a página "Sobre" do canal traz inscritos, visualizações e vídeos
// ---------------------------------------------------------------------------

function channelPath(url: URL): string {
  const parts = url.pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  if (first?.startsWith("@")) return `/${first}`;
  if ((first === "channel" || first === "c" || first === "user") && second) return `/${first}/${second}`;
  throw new LookupError("invalid_url");
}

const textField = (html: string, field: string) => html.match(new RegExp(`"${field}":"([^"]+)"`))?.[1] ?? null;

async function lookupYouTube(url: URL): Promise<ProfileLookup> {
  const path = channelPath(url);
  const html = await getText(`https://www.youtube.com${path}/about?hl=en&gl=US`, { "User-Agent": DESKTOP_USER_AGENT });
  const subscribersText = textField(html, "subscriberCountText");
  if (!subscribersText) throw new LookupError(html.includes("404 Not Found") ? "not_found" : "blocked");
  const subscribers = parseCount(subscribersText);
  const views = html.match(/"viewCountText":"([\d,]+) views"/)?.[1];
  const videos = textField(html, "videoCountText");
  const canonical = textField(html, "canonicalChannelUrl") ?? `https://www.youtube.com${path}`;
  const handle = canonical.match(/\/(@[^/?#"]+)/)?.[1] ?? (path.startsWith("/@") ? path.slice(1) : `@${path.split("/").pop() ?? ""}`);
  return {
    ...empty,
    platform: "youtube",
    handle,
    displayName: metaContent(html, "og:title") ?? handle,
    profileUrl: canonical.replace(/^http:/, "https:"),
    followers: subscribers?.value ?? 0,
    approximate: subscribers?.approximate ?? true,
    views: views ? (parseCount(views)?.value ?? null) : null,
    videos: videos ? (parseCount(videos)?.value ?? null) : null,
    bio: metaContent(html, "og:description"),
    avatarDataUrl: await fetchAvatar(metaContent(html, "og:image")),
    fetchedAt: new Date().toISOString(),
  };
}

const LOOKUPS: Record<LookupPlatform, (url: URL) => Promise<ProfileLookup>> = {
  tiktok: lookupTikTok,
  instagram: lookupInstagram,
  youtube: lookupYouTube,
};

export async function lookupProfile(rawUrl: string): Promise<ProfileLookup> {
  const target = await parseProfileUrl(rawUrl);
  return LOOKUPS[target.platform](target.url);
}
