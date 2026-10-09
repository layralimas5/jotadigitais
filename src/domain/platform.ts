export const PLATFORMS = ["tiktok", "instagram", "youtube", "facebook"] as const;

export type Platform = (typeof PLATFORMS)[number];

export const PLATFORM_LABEL: Record<Platform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  facebook: "Facebook",
};

/** No YouTube quem acompanha o canal é "inscrito"; nas outras redes, "seguidor". */
export const AUDIENCE_LABEL: Record<Platform, string> = {
  tiktok: "Seguidores",
  instagram: "Seguidores",
  youtube: "Inscritos",
  facebook: "Seguidores",
};

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}
