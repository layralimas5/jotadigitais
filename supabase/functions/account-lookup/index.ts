// Busca os dados públicos de uma conta pelo link (aba Contas, botão "Puxar dados").
// Só administradores logados podem chamar: a função faz requisições em nome do servidor.
// Deploy: npx supabase functions deploy account-lookup
// Instagram pela API oficial: secrets META_IG_USER_ID e META_ACCESS_TOKEN (ver docs/instagram-api.md).
import { createClient } from "npm:@supabase/supabase-js@2.117.3";
import { instagramGraphFromEnv, LookupError, lookupProfile, type LookupErrorCode } from "./lookup.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type ErrorCode = LookupErrorCode | "forbidden";

const STATUS: Record<ErrorCode, number> = {
  forbidden: 403,
  invalid_url: 400,
  unsupported: 400,
  not_found: 404,
  blocked: 502,
  failed: 502,
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } });
}

const failWith = (code: ErrorCode) => json({ error: code }, STATUS[code]);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (request.method !== "POST") return failWith("invalid_url");

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  if (!url || !anonKey) return failWith("failed");

  const caller = createClient(url, anonKey, { global: { headers: { Authorization: request.headers.get("Authorization") ?? "" } } });
  // Quem cadastra contas (Jota, desenvolvedora ou ajudante com Contas).
  const { data: allowed } = await caller.rpc("has_permission", { p_permission: "accounts" });
  if (allowed !== true) return failWith("forbidden");

  const body: unknown = await request.json().catch(() => null);
  const profileUrl = typeof body === "object" && body !== null ? (body as Record<string, unknown>).url : null;
  if (typeof profileUrl !== "string" || profileUrl.length > 300) return failWith("invalid_url");

  try {
    return json(await lookupProfile(profileUrl, { instagramGraph: instagramGraphFromEnv((name) => Deno.env.get(name)) }));
  } catch (error) {
    if (error instanceof LookupError) return failWith(error.code);
    console.error(error);
    return failWith("failed");
  }
});
