import { FunctionsHttpError, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { ProfileLookupService } from "@/application/ports";
import { PROFILE_LOOKUP_ERRORS, ProfileLookupError, type ProfileLookup } from "@/domain/profile-lookup";

const count = z.number().int().nonnegative();

/** A resposta vem de fora (função do servidor lendo a rede): tudo é validado antes de chegar na tela. */
const profileLookupSchema = z.object({
  platform: z.enum(["tiktok", "instagram", "youtube"]),
  handle: z.string().min(2),
  displayName: z.string(),
  profileUrl: z.string().url(),
  followers: count,
  approximate: z.boolean(),
  following: count.nullable(),
  likes: count.nullable(),
  posts: count.nullable(),
  videos: count.nullable(),
  views: count.nullable(),
  professional: z.boolean().nullable(),
  verified: z.boolean().nullable(),
  bio: z.string().nullable(),
  avatarDataUrl: z.string().startsWith("data:image/").nullable(),
  fetchedAt: z.string(),
});

const errorBodySchema = z.object({ error: z.enum(PROFILE_LOOKUP_ERRORS) });

function parseLookup(body: unknown): ProfileLookup {
  const result = profileLookupSchema.safeParse(body);
  if (!result.success) {
    console.error(result.error);
    throw new ProfileLookupError("failed");
  }
  return result.data;
}

const errorCodeOf = (body: unknown) => {
  const parsed = errorBodySchema.safeParse(body);
  return parsed.success ? parsed.data.error : "failed";
};

/** Com o Supabase ligado: Edge Function `account-lookup`, que só atende administradores. */
export class SupabaseProfileLookupService implements ProfileLookupService {
  constructor(private readonly client: SupabaseClient) {}

  async lookup(url: string): Promise<ProfileLookup> {
    const { data, error } = await this.client.functions.invoke("account-lookup", { body: { url } });
    if (error) {
      const body: unknown = error instanceof FunctionsHttpError ? await error.context.json().catch(() => null) : null;
      throw new ProfileLookupError(errorCodeOf(body));
    }
    return parseLookup(data);
  }
}

/** No modo demonstração: o servidor de desenvolvimento do Vite responde em /api/account-lookup. */
export class DevServerProfileLookupService implements ProfileLookupService {
  async lookup(url: string): Promise<ProfileLookup> {
    let response: Response;
    try {
      response = await fetch("/api/account-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
    } catch {
      throw new ProfileLookupError("unavailable");
    }
    const isJson = response.headers.get("content-type")?.includes("application/json") ?? false;
    if (!isJson) throw new ProfileLookupError("unavailable");
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new ProfileLookupError(errorCodeOf(body));
    return parseLookup(body);
  }
}
